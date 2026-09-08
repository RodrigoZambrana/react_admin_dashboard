import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import type { Role } from './roles.decorator'
import { SESSION_TTL_MILLISECONDS } from './auth.config'
import { GoogleConfigService } from '../common/integrations/google-config.service'
import { resolveUserCapabilityEnvelope } from './capabilities'
import { UserManagementPolicyService } from './user-management-policy'
import { isLocalTestRecaptchaBypassEnabled } from '../common/security/recaptcha'

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
const parseBootstrapAdminValue = (value: string | null | undefined) => {
  if (!value) {
    return null
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const normalizeLanguagePreference = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized.startsWith('es')) {
    return 'es'
  }
  if (normalized.startsWith('en')) {
    return 'en'
  }
  return 'en'
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly googleConfig: GoogleConfigService,
    private readonly userManagementPolicy: UserManagementPolicyService,
  ) {}

  async verifyRecaptcha(token: string | undefined | null, remoteIp?: string) {
    if (isLocalTestRecaptchaBypassEnabled()) {
      return
    }

    const config = await this.googleConfig.getEffectiveConfig()
    const isEnabled = config.recaptcha.enabled && Boolean(config.recaptcha.secretKey)
    if (!isEnabled) {
      return
    }

    const secretKey = config.recaptcha.secretKey

    if (!secretKey) {
      throw new UnauthorizedException('No se configuró la clave de reCAPTCHA.')
    }

    if (!token) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }

    const form = new URLSearchParams({
      secret: secretKey,
      response: token,
    })

    if (remoteIp) {
      form.set('remoteip', remoteIp)
    }

    let response
    try {
      response = await fetch(RECAPTCHA_VERIFY_URL, {
        method: 'POST',
        body: form,
      })
    } catch (error) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }

    if (!response.ok) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }

    const payload = (await response.json()) as {
      success?: boolean
      'error-codes'?: string[]
    }

    if (!payload.success) {
      throw new UnauthorizedException('No se pudo validar el reCAPTCHA.')
    }
  }

  private async resolveBootstrapPasswordRotation(userEmail: string) {
    const record = await this.prisma.systemConfig.findUnique({
      where: { key: 'auth.bootstrapAdmin' },
      select: { value: true },
    })
    const payload = parseBootstrapAdminValue(record?.value)
    const bootstrapEmail = String(payload?.email ?? '')
      .trim()
      .toLowerCase()
    const passwordRotationRequired = Boolean(payload?.passwordRotationRequired)

    return Boolean(
      bootstrapEmail &&
        passwordRotationRequired &&
        bootstrapEmail === userEmail.trim().toLowerCase(),
    )
  }

  async validateUser(email: string, pass: string) {
    const normalizedEmail = (email || '').trim()
    if (!normalizedEmail) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const lowered = normalizedEmail.toLowerCase()

    const user =
      (await this.prisma.user.findFirst({
        where: { email: { equals: lowered, mode: 'insensitive' } },
      })) || null

    if (!user) throw new UnauthorizedException('Invalid credentials')
    const ok = await bcrypt.compare(pass, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Invalid credentials')
    return user
  }

  private async buildSessionResponse(
    user: {
      id: number
      email: string
      role: Role
      img?: string | null
      name?: string | null
      lastName?: string | null
      lang?: string | null
      capabilityGroups?: string[] | null
      directCapabilities?: string[] | null
    },
    token: string,
    expiresAt: string,
  ) {
    const lang = normalizeLanguagePreference(user.lang)
    const capabilityState = resolveUserCapabilityEnvelope(user)
    const userManagementPolicy = await this.userManagementPolicy.getUserManagementPolicySnapshot({
      role: user.role,
      authority: [user.role],
    })
    const mustChangePassword = await this.resolveBootstrapPasswordRotation(user.email)
    return {
      token,
      expiresAt,
      user: {
        authority: [user.role],
        avatar: user.img || '',
        email: user.email,
        name: user.name || '',
        lastName: user.lastName || '',
        lang,
        capabilityGroups: capabilityState.capabilityGroups,
        directCapabilities: capabilityState.directCapabilities,
        capabilityEnvelope: capabilityState.capabilityEnvelope,
        capabilitySource: capabilityState.source,
        userManagementPolicy,
        mustChangePassword,
      },
    }
  }

  async signToken(user: {
    id: number
    email: string
    role: Role
    img?: string | null
    name?: string | null
    lastName?: string | null
    lang?: string | null
    capabilityGroups?: string[] | null
    directCapabilities?: string[] | null
  }) {
    const lang = normalizeLanguagePreference(user.lang)
    const capabilityState = resolveUserCapabilityEnvelope(user)
    const payload = {
      sub: user.id,
      email: user.email,
      authority: [user.role],
      avatar: user.img || '',
      role: user.role,
      name: user.name || '',
      lastName: user.lastName || '',
      lang,
      scope: 'admin' as const,
      capabilityGroups: capabilityState.capabilityGroups,
      directCapabilities: capabilityState.directCapabilities,
      capabilityEnvelope: capabilityState.capabilityEnvelope,
      capabilitySource: capabilityState.source,
    }
    const token = this.jwt.sign(payload)
    const expiresAt = new Date(Date.now() + SESSION_TTL_MILLISECONDS).toISOString()
    return this.buildSessionResponse(user, token, expiresAt)
  }

  async resolveSession(token: string) {
    try {
      const payload = (await this.jwt.verifyAsync(token)) as {
        sub?: number | string
        scope?: string
        exp?: number
      }

      if (!payload?.sub || (payload.scope && payload.scope !== 'admin')) {
        return null
      }

      const userId = Number(payload.sub)
      if (!Number.isInteger(userId) || userId <= 0) {
        return null
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      })
      if (!user) {
        return null
      }

      const expiresAt =
        typeof payload.exp === 'number'
          ? new Date(payload.exp * 1000).toISOString()
          : new Date(Date.now() + SESSION_TTL_MILLISECONDS).toISOString()

      return this.buildSessionResponse(user, token, expiresAt)
    } catch {
      return null
    }
  }
}
