import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { EmailService } from '../email/email.service'
import { createHash, randomBytes } from 'crypto'
import * as bcrypt from 'bcrypt'
import type { FastifyRequest } from 'fastify'
import { UserActivityService } from '../user-activity/user-activity.service'
import { ThrottlerException } from '@nestjs/throttler'

const PASSWORD_MIN_LENGTH = 8

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name)
  private readonly tokenTtlMs: number
  private readonly requestWindowMs: number
  private readonly maxRequestsPerWindow: number
  private readonly maxRequestsPerIp: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly userActivity: UserActivityService,
  ) {
    this.tokenTtlMs = Number(this.config.get<string>('PASSWORD_RESET_TOKEN_TTL_MS') ?? 60 * 60 * 1000)
    this.requestWindowMs = Number(this.config.get<string>('PASSWORD_RESET_WINDOW_MS') ?? 15 * 60 * 1000)
    this.maxRequestsPerWindow = Number(this.config.get<string>('PASSWORD_RESET_MAX_REQUESTS') ?? 3)
    this.maxRequestsPerIp = Number(this.config.get<string>('PASSWORD_RESET_MAX_REQUESTS_PER_IP') ?? 10)
  }

  async requestReset(emailRaw: string, req?: FastifyRequest) {
    const email = emailRaw.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      throw new BadRequestException('auth.passwordReset.invalidEmail')
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })
    const customer = user
      ? null
      : await this.prisma.customer.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        })

    if (!user && !customer) {
      // Silently succeed to avoid leaking existence of accounts
      this.logger.debug(`Password reset requested for non-existent email: ${email}`)
      return
    }

    const now = Date.now()
    const windowStart = new Date(now - this.requestWindowMs)

    if (user) {
      const recentCount = await this.prisma.passwordResetToken.count({
        where: {
          userId: user.id,
          createdAt: { gte: windowStart },
        },
      })
      if (recentCount >= this.maxRequestsPerWindow) {
        throw new ThrottlerException('auth.passwordReset.tooManyRequests')
      }
    } else if (customer) {
      const recentCount = await this.prisma.passwordResetToken.count({
        where: {
          customerId: customer.id,
          createdAt: { gte: windowStart },
        },
      })
      if (recentCount >= this.maxRequestsPerWindow) {
        throw new ThrottlerException('auth.passwordReset.tooManyRequests')
      }
    }

    const ipAddress = req?.ip ?? null
    if (ipAddress) {
      const ipCount = await this.prisma.passwordResetToken.count({
        where: {
          ipAddress,
          createdAt: { gte: windowStart },
        },
      })
      if (ipCount >= this.maxRequestsPerIp) {
        throw new ThrottlerException('auth.passwordReset.tooManyRequests')
      }
    }

    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(now + this.tokenTtlMs)

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user?.id ?? null,
        customerId: customer?.id ?? null,
        expiresAt,
        ipAddress,
      },
    })

    const resetUrl = this.buildResetUrl(token, Boolean(user))
    const displayName = user
      ? `${user.name ?? ''} ${user.lastName ?? ''}`.trim() || user.email
      : `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim() || customer?.email || email

    await this.emailService.sendPasswordReset({
      email,
      resetUrl,
      expiresAt,
      locale: user?.lang ?? null,
      displayName,
      isAdmin: Boolean(user),
    })
  }

  async resetPassword(token: string, newPassword: string, req?: FastifyRequest) {
    if (!token || !token.trim()) {
      throw new BadRequestException('auth.passwordReset.invalidToken')
    }
    this.validatePassword(newPassword)

    const tokenHash = createHash('sha256').update(token.trim()).digest('hex')
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) {
      throw new BadRequestException('auth.passwordReset.invalidToken')
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await this.prisma.$transaction(async (tx) => {
      if (record.userId) {
        await tx.user.update({
          where: { id: record.userId },
          data: {
            passwordHash: hashedPassword,
          },
        })
      } else if (record.customerId) {
        await tx.customer.update({
          where: { id: record.customerId },
          data: {
            passwordHash: hashedPassword,
            storefrontDefaultPasswordHash: null,
          },
        })
      }

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      })

      await tx.passwordResetToken.updateMany({
        where: {
          id: { not: record.id },
          OR: [{ userId: record.userId }, { customerId: record.customerId }],
          usedAt: null,
        },
        data: { expiresAt: new Date() },
      })
    })

    if (record.userId) {
      if (req) {
        await this.userActivity.recordPasswordChange(record.userId, 'reset', req)
      }
    }
  }

  private validatePassword(password: string) {
    const trimmed = password.trim()
    if (trimmed.length < PASSWORD_MIN_LENGTH) {
      throw new BadRequestException('auth.passwordReset.passwordTooShort')
    }
  }

  private buildResetUrl(token: string, isAdmin: boolean) {
    const encodedToken = encodeURIComponent(token)
    const template = isAdmin
      ? this.config.get<string>('ADMIN_PASSWORD_RESET_URL')
      : this.config.get<string>('CUSTOMER_PASSWORD_RESET_URL')

    const fallbackBase = isAdmin
      ? this.config.get<string>('ADMIN_APP_URL') ?? ''
      : this.config.get<string>('STOREFRONT_BASE_URL') ?? ''

    const defaultUrl = fallbackBase
      ? `${fallbackBase.replace(/\/$/, '')}/reset-password?token=${encodedToken}`
      : `https://example.com/reset-password?token=${encodedToken}`

    if (!template) {
      return defaultUrl
    }

    if (template.includes('{{token}}')) {
      return template.replace(/{{token}}/g, encodedToken)
    }
    const separator = template.includes('?') ? '&' : '?'
    return `${template}${separator}token=${encodedToken}`
  }
}
