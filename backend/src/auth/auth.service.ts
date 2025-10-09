import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async verifyRecaptcha(token: string | undefined | null, remoteIp?: string) {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY

    if (!secretKey) {
      // No se configuró reCAPTCHA para el backend, omite la validación.
      return
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

  async validateUser(userName: string, pass: string) {
    const identifier = (userName || '').trim()
    if (!identifier) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const lowered = identifier.toLowerCase()

    const user =
      (await this.prisma.user.findFirst({
        where: {
          OR: [
            { userName: { equals: identifier, mode: 'insensitive' } },
            { email: { equals: lowered, mode: 'insensitive' } },
          ],
        },
      })) || null

    if (!user) throw new UnauthorizedException('Invalid credentials')
    const ok = await bcrypt.compare(pass, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Invalid credentials')
    return user
  }

  signToken(user: {
    id: number
    userName: string
    email: string
    role: 'SUPERADMIN' | 'ADMIN' | 'USER'
    img?: string | null
    name?: string | null
    lastName?: string | null
  }) {
    const payload = {
      sub: user.id,
      userName: user.userName,
      email: user.email,
      authority: [user.role],
      avatar: user.img || '',
      role: user.role,
      name: user.name || '',
      lastName: user.lastName || '',
    }
    const token = this.jwt.sign(payload)
    return {
      token,
      user: {
        userName: user.userName,
        authority: [user.role],
        avatar: user.img || '',
        email: user.email,
        name: user.name || '',
        lastName: user.lastName || '',
      },
    }
  }
}
