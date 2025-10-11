import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import type { Role } from './roles.decorator'
import { SESSION_TTL_MILLISECONDS } from './auth.config'

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async verifyRecaptcha(token: string | undefined | null, remoteIp?: string) {
    const isEnabled =
      String(process.env.RECAPTCHA_ENABLED || '').toLowerCase() === 'true'
    if (!isEnabled) {
      return
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY

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

  signToken(user: {
    id: number
    email: string
    role: Role
    img?: string | null
    name?: string | null
    lastName?: string | null
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      authority: [user.role],
      avatar: user.img || '',
      role: user.role,
      name: user.name || '',
      lastName: user.lastName || '',
    }
    const token = this.jwt.sign(payload)
    const expiresAt = new Date(Date.now() + SESSION_TTL_MILLISECONDS).toISOString()
    return {
      token,
      expiresAt,
      user: {
        authority: [user.role],
        avatar: user.img || '',
        email: user.email,
        name: user.name || '',
        lastName: user.lastName || '',
      },
    }
  }
}
