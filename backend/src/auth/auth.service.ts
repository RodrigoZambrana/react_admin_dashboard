import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import type { Role } from './roles.decorator'
import { SESSION_TTL_MILLISECONDS } from './auth.config'
import { GoogleConfigService } from '../common/integrations/google-config.service'

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

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
  ) {}

  async verifyRecaptcha(token: string | undefined | null, remoteIp?: string) {
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

  private buildSessionResponse(
    user: {
      id: number
      email: string
      role: Role
      img?: string | null
      name?: string | null
      lastName?: string | null
      lang?: string | null
    },
    token: string,
    expiresAt: string,
  ) {
    const lang = normalizeLanguagePreference(user.lang)
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
      },
    }
  }

  signToken(user: {
    id: number
    email: string
    role: Role
    img?: string | null
    name?: string | null
    lastName?: string | null
    lang?: string | null
  }) {
    const lang = normalizeLanguagePreference(user.lang)
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
