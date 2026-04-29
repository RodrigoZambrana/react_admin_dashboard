import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, OtpCodeType, UserStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import type { FastifyRequest } from 'fastify'
import { EmailService } from '../email/email.service'
import { PrismaService } from '../prisma/prisma.service'
import { normalizePhoneNumber, buildPhoneLookupCandidates } from '../common/utils/phone'
import { AuthAuditService } from './auth-audit.service'
import { OtpRateLimitService } from './otp-rate-limit.service'
import {
  DEFAULT_OTP_LENGTH,
  DEFAULT_OTP_MAX_ATTEMPTS,
  DEFAULT_OTP_TTL_MS,
} from './otp/otp.constants'
import {
  compareHashedOtpValue,
  generateOtpCode,
  generateRecoveryToken,
  hashOtpValue,
  maskPhoneNumber,
  normalizeIdentifier,
} from './otp/otp.utils'
import { SmsProviderFactory } from './sms/sms-provider.factory'
import { SmsTemplateService } from './sms/sms-template.service'

type RegisterPhoneDto = {
  phone: string
  email?: string | null
  password: string
  name?: string | null
  lastName?: string | null
  locale?: string | null
}

type SendOtpDto = {
  phone: string
  type?: 'verification' | 'recovery'
}

type VerifyOtpDto = {
  phone: string
  code: string
}

type RecoverDto = {
  method: 'sms' | 'email'
  phone?: string | null
  email?: string | null
}

type ResetPasswordDto = {
  method: 'sms' | 'email'
  phone?: string | null
  email?: string | null
  code?: string | null
  token?: string | null
  password: string
}

type StoredUser = Awaited<ReturnType<PrismaService['user']['findUnique']>>

const DEFAULT_PLACEHOLDER_EMAIL_DOMAIN = 'noemail.local'

@Injectable()
export class PhoneAuthService {
  private readonly logger = new Logger(PhoneAuthService.name)
  private readonly otpLength: number
  private readonly otpTtlMs: number
  private readonly otpMaxAttempts: number
  private readonly authOtpSecret: string
  private readonly resetBaseUrl: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly smsProviderFactory: SmsProviderFactory,
    private readonly smsTemplates: SmsTemplateService,
    private readonly rateLimit: OtpRateLimitService,
    private readonly audit: AuthAuditService,
  ) {
    this.otpLength = Number(this.config.get<string>('AUTH_OTP_LENGTH') ?? DEFAULT_OTP_LENGTH)
    this.otpTtlMs = Number(this.config.get<string>('AUTH_OTP_TTL_MS') ?? DEFAULT_OTP_TTL_MS)
    this.otpMaxAttempts = Number(this.config.get<string>('AUTH_OTP_MAX_ATTEMPTS') ?? DEFAULT_OTP_MAX_ATTEMPTS)
    this.authOtpSecret =
      this.config.get<string>('AUTH_OTP_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      'local-dev-auth-otp-secret-change-me'
    this.resetBaseUrl =
      this.config.get<string>('AUTH_PASSWORD_RESET_URL') ||
      this.config.get<string>('STOREFRONT_BASE_URL') ||
      this.config.get<string>('APP_PUBLIC_URL') ||
      'http://localhost:3000'
  }

  async register(dto: RegisterPhoneDto, req?: FastifyRequest) {
    const phone = this.normalizePhone(dto.phone)
    if (!phone) {
      throw new BadRequestException('Invalid phone number')
    }
    if (!dto.password?.trim()) {
      throw new BadRequestException('Password is required')
    }

    const email = this.normalizeEmailOrPlaceholder(dto.email, phone)
    const passwordHash = await bcrypt.hash(dto.password, 12)
    const name = dto.name?.trim() || null
    const lastName = dto.lastName?.trim() || null

    const [byPhone, byEmail] = await Promise.all([
      this.prisma.user.findFirst({ where: { phone } }),
      dto.email ? this.prisma.user.findFirst({ where: { email } }) : Promise.resolve(null),
    ])

    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      throw new ConflictException('Account already exists')
    }

    const existing = byPhone ?? byEmail
    if (existing && existing.status === UserStatus.BLOCKED) {
      throw new ConflictException('Account is blocked')
    }

    if (existing && existing.status === UserStatus.ACTIVE) {
      throw new ConflictException('Phone number is already registered')
    }

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            phone,
            email,
            passwordHash,
            name: name ?? existing.name,
            lastName: lastName ?? existing.lastName,
            status: UserStatus.PENDING_VERIFICATION,
          },
        })
      : await this.prisma.user.create({
          data: {
            phone,
            email,
            passwordHash,
            name,
            lastName,
            status: UserStatus.PENDING_VERIFICATION,
          },
        })

    await this.issueOtp({
      user,
      type: OtpCodeType.VERIFICATION,
      target: phone,
      req,
      auditEvent: 'ACCOUNT_REGISTERED',
      channel: 'sms',
    })

    return {
      ok: true,
      userId: user.id,
      phone: user.phone,
      status: user.status,
      verification: {
        phone: maskPhoneNumber(phone),
        otpLength: this.otpLength,
        expiresInSeconds: Math.max(1, Math.round(this.otpTtlMs / 1000)),
      },
    }
  }

  async sendOtp(dto: SendOtpDto, req?: FastifyRequest) {
    const phone = this.normalizePhone(dto.phone)
    if (!phone) {
      throw new BadRequestException('Invalid phone number')
    }

    const user = await this.findUserByPhone(phone)
    if (!user) {
      return { ok: true }
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new ConflictException('Account is blocked')
    }

    await this.issueOtp({
      user,
      type: dto.type === 'recovery' ? OtpCodeType.RECOVERY : OtpCodeType.VERIFICATION,
      target: phone,
      req,
      auditEvent: 'OTP_SENT',
      channel: 'sms',
    })

    return { ok: true }
  }

  async verifyOtp(dto: VerifyOtpDto, req?: FastifyRequest) {
    const phone = this.normalizePhone(dto.phone)
    if (!phone) {
      throw new BadRequestException('Invalid phone number')
    }

    const user = await this.findUserByPhone(phone)
    if (!user) {
      throw new UnauthorizedException('Invalid OTP')
    }
    if (user.status === UserStatus.BLOCKED) {
      throw new ConflictException('Account is blocked')
    }

    const otp = await this.findLatestOtp(user.id, OtpCodeType.VERIFICATION)
    if (!otp) {
      throw new UnauthorizedException('Invalid OTP')
    }

    await this.assertAttemptBudget(otp)

    const matches = compareHashedOtpValue(dto.code.trim(), otp.codeHash, this.authOtpSecret)
    if (!matches) {
      await this.incrementAttempt(otp.id)
      await this.audit.record({
        userId: user.id,
        eventType: 'OTP_FAILED',
        channel: 'verification',
        metadata: { phone },
        req,
      })
      throw new UnauthorizedException('Invalid OTP')
    }

    await this.prisma.$transaction([
      this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date(), attempts: otp.attempts + 1 },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      }),
    ])

    await this.audit.record({
      userId: user.id,
      eventType: 'OTP_VERIFIED',
      channel: 'verification',
      metadata: { phone },
      req,
    })

    return {
      ok: true,
      userId: user.id,
      status: UserStatus.ACTIVE,
    }
  }

  async recover(dto: RecoverDto, req?: FastifyRequest) {
    const method = dto.method
    if (method === 'sms') {
      const phone = this.normalizePhone(dto.phone)
      if (!phone) {
        throw new BadRequestException('Invalid phone number')
      }
      const user = await this.findUserByPhone(phone)
      if (!user || user.status === UserStatus.BLOCKED) {
        return { ok: true }
      }
      await this.issueOtp({
        user,
        type: OtpCodeType.RECOVERY,
        target: phone,
        req,
        auditEvent: 'PASSWORD_RESET_REQUESTED',
        channel: 'sms',
      })
    return {
      ok: true,
      method: 'sms',
      otpLength: this.otpLength,
      expiresInSeconds: Math.max(1, Math.round(this.otpTtlMs / 1000)),
    }
    }

    const email = this.normalizeEmail(dto.email)
    if (!email) {
      throw new BadRequestException('Invalid email')
    }

    const user = await this.findUserByEmail(email)
    if (!user || user.status === UserStatus.BLOCKED || this.isPlaceholderEmail(user.email)) {
      return { ok: true }
    }

    const token = generateRecoveryToken(32)
    const codeHash = hashOtpValue(token, this.authOtpSecret)
    const expiresAt = new Date(Date.now() + this.otpTtlMs)

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        codeHash,
        type: OtpCodeType.RECOVERY,
        expiresAt,
        attempts: 0,
        target: email,
        channel: 'email',
        metadata: { method: 'email' } as Prisma.InputJsonValue,
      },
    })

    const resetUrl = this.buildResetUrl(token)
    await this.email.sendPasswordReset({
      email,
      resetUrl,
      expiresAt,
      locale: user.lang ?? null,
      displayName: user.name ?? email,
      isAdmin: false,
      event: 'reset_link',
    })

    await this.audit.record({
      userId: user.id,
      eventType: 'PASSWORD_RESET_REQUESTED',
      channel: 'email',
      metadata: { email },
      req,
    })

    return {
      ok: true,
      method: 'email',
      expiresInSeconds: Math.max(1, Math.round(this.otpTtlMs / 1000)),
    }
  }

  async resetPassword(dto: ResetPasswordDto, req?: FastifyRequest) {
    if (!dto.password?.trim()) {
      throw new BadRequestException('Password is required')
    }

    const method = dto.method
    const passwordHash = await bcrypt.hash(dto.password, 12)

    if (method === 'sms') {
      const phone = this.normalizePhone(dto.phone)
      if (!phone || !dto.code?.trim()) {
        throw new BadRequestException('Invalid recovery code')
      }

      const user = await this.findUserByPhone(phone)
      if (!user || user.status === UserStatus.BLOCKED) {
        throw new UnauthorizedException('Invalid recovery code')
      }

      const otp = await this.findLatestOtp(user.id, OtpCodeType.RECOVERY)
      if (!otp) {
        throw new UnauthorizedException('Invalid recovery code')
      }

      await this.assertAttemptBudget(otp)
      const matches = compareHashedOtpValue(dto.code.trim(), otp.codeHash, this.authOtpSecret)
      if (!matches) {
        await this.incrementAttempt(otp.id)
        await this.audit.record({
          userId: user.id,
          eventType: 'OTP_FAILED',
          channel: 'recovery-sms',
          metadata: { phone },
          req,
        })
        throw new UnauthorizedException('Invalid recovery code')
      }

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        }),
        this.prisma.otpCode.update({
          where: { id: otp.id },
          data: { consumedAt: new Date(), attempts: otp.attempts + 1 },
        }),
      ])

      await this.audit.record({
        userId: user.id,
        eventType: 'PASSWORD_RESET_COMPLETED',
        channel: 'sms',
        metadata: { phone },
        req,
      })

      return { ok: true }
    }

    const token = dto.token?.trim()
    if (!token) {
      throw new BadRequestException('Invalid recovery token')
    }

    const codeHash = hashOtpValue(token, this.authOtpSecret)
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        codeHash,
        type: OtpCodeType.RECOVERY,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp?.user || otp.user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Invalid recovery token')
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: otp.user.id },
        data: { passwordHash },
      }),
      this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date(), attempts: otp.attempts + 1 },
      }),
    ])

    await this.audit.record({
      userId: otp.user.id,
      eventType: 'PASSWORD_RESET_COMPLETED',
      channel: 'email',
      metadata: { email: otp.user.email },
      req,
    })

    return { ok: true }
  }

  async resendVerification(phoneRaw: string, req?: FastifyRequest) {
    return this.sendOtp({ phone: phoneRaw, type: 'verification' }, req)
  }

  private async issueOtp(input: {
    user: NonNullable<StoredUser>
    type: OtpCodeType
    target: string
    req?: FastifyRequest
    auditEvent: 'ACCOUNT_REGISTERED' | 'OTP_SENT' | 'PASSWORD_RESET_REQUESTED'
    channel: 'sms'
  }) {
    await this.rateLimit.assertAllowed({
      identifierKey: `phone:${input.target}`,
      subjectKey: `user:${input.user.id}`,
    })

    const code = generateOtpCode(this.otpLength)
    const codeHash = hashOtpValue(code, this.authOtpSecret)
    const expiresAt = new Date(Date.now() + this.otpTtlMs)

    await this.prisma.otpCode.updateMany({
      where: {
        userId: input.user.id,
        type: input.type,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    })

    await this.prisma.otpCode.create({
      data: {
        userId: input.user.id,
        codeHash,
        type: input.type,
        expiresAt,
        attempts: 0,
        target: input.target,
        channel: input.channel,
        metadata: {
          otpLength: this.otpLength,
          phone: input.target,
          type: input.type,
        } as Prisma.InputJsonValue,
      },
    })

    const smsMessage = this.smsTemplates.render(input.type === OtpCodeType.VERIFICATION ? 'verification' : 'recovery', {
      code,
      ttlMinutes: Math.max(1, Math.round(this.otpTtlMs / 60_000)),
    })

    try {
      await this.smsProviderFactory.getProvider().sendSms(input.target, smsMessage)
    } catch (error) {
      this.logger.error(`SMS send failed for ${maskPhoneNumber(input.target)}: ${(error as Error).message}`)
      await this.audit.record({
        userId: input.user.id,
        eventType: 'PROVIDER_FAILURE',
        channel: 'sms',
        metadata: {
          target: input.target,
          type: input.type,
          reason: (error as Error).message,
        },
        req: input.req,
      })
      throw error
    }

    await this.audit.record({
      userId: input.user.id,
      eventType: input.auditEvent,
      channel: 'sms',
      metadata: {
        target: input.target,
        type: input.type,
        expiresAt: expiresAt.toISOString(),
      },
      req: input.req,
    })
  }

  private async findLatestOtp(userId: number, type: OtpCodeType) {
    return this.prisma.otpCode.findFirst({
      where: {
        userId,
        type,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  private async assertAttemptBudget(otp: { attempts: number } | null) {
    if (!otp) {
      throw new UnauthorizedException('Invalid OTP')
    }
    if (otp.attempts >= this.otpMaxAttempts) {
      throw new UnauthorizedException('OTP locked')
    }
  }

  private async incrementAttempt(id: number) {
    await this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  }

  private normalizePhone(value?: string | null) {
    return normalizePhoneNumber(value ?? null)
  }

  private normalizeEmail(value?: string | null) {
    const normalized = normalizeIdentifier(value)
    if (!normalized || !normalized.includes('@')) {
      return null
    }
    return normalized
  }

  private normalizeEmailOrPlaceholder(email: string | null | undefined, phone: string) {
    const normalizedEmail = this.normalizeEmail(email)
    if (normalizedEmail) {
      return normalizedEmail
    }
    if (typeof email === 'string' && email.trim().length > 0) {
      throw new BadRequestException('Invalid email')
    }
    const digits = phone.replace(/\D/g, '')
    return `phone-${digits}@${DEFAULT_PLACEHOLDER_EMAIL_DOMAIN}`
  }

  private isPlaceholderEmail(email: string) {
    return email.endsWith(`@${DEFAULT_PLACEHOLDER_EMAIL_DOMAIN}`)
  }

  private buildResetUrl(token: string) {
    const normalizedBase = this.resetBaseUrl.replace(/\/$/, '')
    return `${normalizedBase}/auth/reset-password?token=${encodeURIComponent(token)}&method=email`
  }

  private async findUserByPhone(phone: string) {
    const candidates = buildPhoneLookupCandidates(phone)
    if (!candidates.length) {
      return null
    }
    return this.prisma.user.findFirst({
      where: {
        phone: {
          in: candidates,
        },
      },
    })
  }

  private async findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })
  }
}
