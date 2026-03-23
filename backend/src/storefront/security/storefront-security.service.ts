import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { EmailService } from '../../email/email.service'
import { randomBytes, createHash, timingSafeEqual, randomInt } from 'crypto'
import type { FastifyRequest } from 'fastify'
import { Prisma, Customer, CustomerSecurityEventType, CustomerReauthMethod, PasswordResetChannel, CustomerOtpChallenge } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { buildPhoneLookupCandidates, normalizePhoneNumber } from '../../common/utils/phone'

type RecoveryChannel = 'email' | 'phone' | 'google'

type RateLimitTarget = {
  customerId?: number | null
  identifierHash?: string | null
  ipAddress?: string | null
}

type ReauthTokenRecord = {
  token: string
  expiresAt: Date
}

type ResetSessionToken = {
  token: string
  expiresAt: Date
}

const PASSWORD_MIN_LENGTH = 10
const PASSWORD_MAX_LENGTH = 256
const OTP_LENGTH = 6

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const hashSha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

const timingSafeCompare = (candidate: string, hashed: string): boolean => {
  const candidateHash = Buffer.from(hashSha256(candidate), 'hex')
  const storedHash = Buffer.from(hashed, 'hex')
  if (candidateHash.length !== storedHash.length) {
    return false
  }
  return timingSafeEqual(candidateHash, storedHash)
}

@Injectable()
export class StorefrontSecurityService {
  private readonly logger = new Logger(StorefrontSecurityService.name)
  private readonly resetTokenTtlMs: number
  private readonly resetRateLimitWindowMs: number
  private readonly resetRateLimitPerIdentifier: number
  private readonly resetRateLimitPerIp: number
  private readonly otpTtlMs: number
  private readonly otpMaxAttempts: number
  private readonly otpRateLimitPerPhone: number
  private readonly otpRateLimitPerIp: number
  private readonly otpResendCooldownMs: number
  private readonly reauthTokenTtlMs: number
  private readonly emailVerificationTtlMs: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    this.resetTokenTtlMs = Number(this.config.get<string>('CUSTOMER_PASSWORD_RESET_TTL_MS') ?? 30 * 60 * 1000)
    this.resetRateLimitWindowMs = Number(this.config.get<string>('CUSTOMER_PASSWORD_RESET_WINDOW_MS') ?? 60 * 60 * 1000)
    this.resetRateLimitPerIdentifier = Number(this.config.get<string>('CUSTOMER_PASSWORD_RESET_MAX_PER_IDENTIFIER') ?? 3)
    this.resetRateLimitPerIp = Number(this.config.get<string>('CUSTOMER_PASSWORD_RESET_MAX_PER_IP') ?? 10)
    this.otpTtlMs = Number(this.config.get<string>('CUSTOMER_PASSWORD_OTP_TTL_MS') ?? 5 * 60 * 1000)
    this.otpMaxAttempts = Number(this.config.get<string>('CUSTOMER_PASSWORD_OTP_MAX_ATTEMPTS') ?? 5)
    this.otpRateLimitPerPhone = Number(this.config.get<string>('CUSTOMER_PASSWORD_OTP_MAX_PER_PHONE') ?? 3)
    this.otpRateLimitPerIp = Number(this.config.get<string>('CUSTOMER_PASSWORD_OTP_MAX_PER_IP') ?? 10)
    this.otpResendCooldownMs = Number(this.config.get<string>('CUSTOMER_PASSWORD_OTP_RESEND_COOLDOWN_MS') ?? 60 * 1000)
    this.reauthTokenTtlMs = Number(this.config.get<string>('CUSTOMER_REAUTH_TOKEN_TTL_MS') ?? 10 * 60 * 1000)
    this.emailVerificationTtlMs = Number(
      this.config.get<string>('CUSTOMER_EMAIL_VERIFICATION_TTL_MS') ?? 48 * 60 * 60 * 1000,
    )
  }

  /**
   * Initiates password recovery via email.
   * Does not reveal whether the account exists.
   */
  async requestEmailRecovery(emailRaw: string, req?: FastifyRequest): Promise<void> {
    const email = normalizeEmail(emailRaw)
    if (!email || !email.includes('@')) {
      throw new BadRequestException('auth.passwordRecovery.invalidEmail')
    }

    const ipAddress = req?.ip ?? null
    const userAgent = (req?.headers['user-agent'] as string | undefined) ?? null
    const identifierHash = hashSha256(email)

    await this.enforceRateLimit({
      identifierHash,
      ipAddress,
    })

    const customer = await this.prisma.customer.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })

    if (!customer) {
      await this.logSecurityEvent(null, CustomerSecurityEventType.PASSWORD_RESET_REQUEST, {
        channel: 'email',
        ipAddress,
        userAgent,
        metadata: { identifierHash } as Prisma.InputJsonValue,
      })
      return
    }

    const token = randomBytes(48).toString('hex')
    const tokenHash = hashSha256(token)
    const expiresAt = this.nowPlus(this.resetTokenTtlMs)

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        customerId: customer.id,
        channel: PasswordResetChannel.EMAIL,
        targetIdentifierHash: identifierHash,
        expiresAt,
        ipAddress,
        userAgent,
        metadata: {
          channel: 'email',
        } as Prisma.InputJsonValue,
      },
    })

    const resetUrl = this.buildResetUrl(token)
    await this.email.sendPasswordReset({
      email,
      resetUrl,
      expiresAt,
      displayName: this.resolveDisplayName(customer),
      locale: customer.preferredLocale ?? null,
      isAdmin: false,
    })

    await this.logSecurityEvent(customer.id, CustomerSecurityEventType.PASSWORD_RESET_REQUEST, {
      channel: 'email',
      ipAddress,
      userAgent,
      metadata: { identifierHash } as Prisma.InputJsonValue,
    })
  }

  async requestPhoneRecovery(phoneRaw: string, req?: FastifyRequest): Promise<void> {
    const normalized = normalizePhoneNumber(phoneRaw)
    if (!normalized || normalized.length < 6) {
      throw new BadRequestException('auth.passwordRecovery.invalidPhone')
    }

    const ipAddress = req?.ip ?? null
    const userAgent = (req?.headers['user-agent'] as string | undefined) ?? null
    const identifierHash = hashSha256(normalized)

    await this.enforceOtpRateLimit(normalized, ipAddress)

    const customer = await this.prisma.customer.findFirst({
      where: {
        phoneNumber: {
          in: buildPhoneLookupCandidates(normalized),
        },
      },
    })

    if (!customer) {
      await this.logSecurityEvent(null, CustomerSecurityEventType.PASSWORD_RESET_REQUEST, {
        channel: 'phone',
        ipAddress,
        userAgent,
        metadata: { identifierHash } as Prisma.InputJsonValue,
      })
      return
    }

    await this.logSecurityEvent(customer.id, CustomerSecurityEventType.PASSWORD_RESET_REQUEST, {
      channel: 'phone',
      ipAddress,
      userAgent,
      metadata: { identifierHash } as Prisma.InputJsonValue,
    })

    const existingChallenge = await this.prisma.customerOtpChallenge.findFirst({
      where: {
        customerId: customer.id,
        phone: normalized,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        createdAt: { gt: this.nowPlus(-this.otpResendCooldownMs) },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existingChallenge) {
      await this.logSecurityEvent(customer.id, CustomerSecurityEventType.OTP_SENT, {
        channel: 'phone',
        ipAddress,
        userAgent,
        metadata: { identifierHash, reason: 'cooldown' } as Prisma.InputJsonValue,
      })
      return
    }

    const otp = this.generateOtp()
    const otpHash = hashSha256(otp)
    const expiresAt = this.nowPlus(this.otpTtlMs)

    await this.prisma.customerOtpChallenge.create({
      data: {
        customerId: customer.id,
        phone: normalized,
        otpHash,
        otpLength: OTP_LENGTH,
        maxAttempts: this.otpMaxAttempts,
        channel: 'sms',
        ipAddress,
        userAgent,
        expiresAt,
      },
    })

    if (customer.email) {
      await this.email.sendPasswordReset({
        email: customer.email,
        resetUrl: this.buildSecurityAlertUrl(),
        displayName: this.resolveDisplayName(customer),
        locale: null,
        isAdmin: false,
        event: 'recovery_notice',
      })
    }

    await this.deliverOtp(normalized, otp)

    await this.logSecurityEvent(customer.id, CustomerSecurityEventType.OTP_SENT, {
      channel: 'phone',
      ipAddress,
      userAgent,
      metadata: {
        identifierHash,
        expiry: expiresAt.toISOString(),
      } as Prisma.InputJsonValue,
    })
  }

  async verifyPhoneOtp(phoneRaw: string, otp: string, req?: FastifyRequest): Promise<ResetSessionToken> {
    const normalized = normalizePhoneNumber(phoneRaw)
    if (!normalized || normalized.length < 6) {
      throw new BadRequestException('auth.passwordRecovery.invalidPhone')
    }
    if (!otp || otp.length < 4) {
      throw new BadRequestException('auth.passwordRecovery.invalidOtp')
    }

    const ipAddress = req?.ip ?? null
    const userAgent = (req?.headers['user-agent'] as string | undefined) ?? null

    const challenge = await this.prisma.customerOtpChallenge.findFirst({
      where: {
        phone: {
          in: buildPhoneLookupCandidates(normalized),
        },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!challenge) {
      throw new UnauthorizedException('auth.passwordRecovery.invalidOtp')
    }

    if (challenge.attemptCount >= challenge.maxAttempts) {
      await this.markOtpFailed(challenge, ipAddress, userAgent, 'max_attempts')
      throw new UnauthorizedException('auth.passwordRecovery.otpLocked')
    }

    const matches = timingSafeCompare(otp, challenge.otpHash)
    const now = new Date()

    if (!matches) {
      await this.prisma.customerOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          attemptCount: { increment: 1 } as unknown as number,
          lastAttemptAt: now,
        },
      })
      await this.markOtpFailed(challenge, ipAddress, userAgent, 'invalid_code')
      throw new UnauthorizedException('auth.passwordRecovery.invalidOtp')
    }

    const reauthToken = await this.createReauthToken(challenge.customerId, CustomerReauthMethod.OTP, {
      phone: normalized,
    }, ipAddress, userAgent)

    await this.prisma.customerOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: now,
        lastAttemptAt: now,
      },
    })

    await this.logSecurityEvent(challenge.customerId, CustomerSecurityEventType.OTP_VERIFIED, {
      channel: 'phone',
      ipAddress,
      userAgent,
      metadata: { phone: normalized } as Prisma.InputJsonValue,
    })

    return {
      token: reauthToken.token,
      expiresAt: reauthToken.expiresAt,
    }
  }

  async resetPasswordWithEmailToken(token: string, newPassword: string, req?: FastifyRequest): Promise<void> {
    const trimmedToken = token.trim()
    if (!trimmedToken) {
      throw new BadRequestException('auth.passwordRecovery.invalidToken')
    }
    this.validatePassword(newPassword)

    const tokenHash = hashSha256(trimmedToken)
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        channel: PasswordResetChannel.EMAIL,
      },
    })
    if (!record || !record.customerId) {
      throw new BadRequestException('auth.passwordRecovery.invalidToken')
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: record.customerId } })
    if (!customer) {
      throw new NotFoundException('auth.passwordRecovery.invalidToken')
    }

    await this.performPasswordUpdate(customer, newPassword, {
      method: 'email',
      ipAddress: req?.ip ?? null,
      userAgent: (req?.headers['user-agent'] as string | undefined) ?? null,
    })

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: {
          customerId: record.customerId,
          usedAt: null,
          id: { not: record.id },
        },
        data: { expiresAt: new Date() },
      }),
    ])

    await this.logSecurityEvent(customer.id, CustomerSecurityEventType.PASSWORD_RESET_COMPLETED, {
      channel: 'email',
      ipAddress: req?.ip ?? null,
      userAgent: (req?.headers['user-agent'] as string | undefined) ?? null,
    })
  }

  async resetPasswordWithSessionToken(resetSessionToken: string, newPassword: string, req?: FastifyRequest): Promise<void> {
    const trimmed = resetSessionToken.trim()
    if (!trimmed) {
      throw new BadRequestException('auth.passwordRecovery.invalidToken')
    }
    this.validatePassword(newPassword)

    const tokenHash = hashSha256(trimmed)
    const record = await this.prisma.customerReauthToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        method: CustomerReauthMethod.OTP,
      },
    })

    if (!record) {
      throw new BadRequestException('auth.passwordRecovery.invalidToken')
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: record.customerId } })
    if (!customer) {
      throw new NotFoundException('auth.passwordRecovery.invalidToken')
    }

    await this.performPasswordUpdate(customer, newPassword, {
      method: 'phone',
      ipAddress: req?.ip ?? null,
      userAgent: (req?.headers['user-agent'] as string | undefined) ?? null,
    })

    await this.prisma.customerReauthToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    await this.logSecurityEvent(customer.id, CustomerSecurityEventType.PASSWORD_RESET_COMPLETED, {
      channel: 'phone',
      ipAddress: req?.ip ?? null,
      userAgent: (req?.headers['user-agent'] as string | undefined) ?? null,
    })
  }

  async sendEmailVerification(customerId: number, req?: FastifyRequest): Promise<void> {
    const customer = await this.requireCustomer(customerId)
    const email = customer.email ? normalizeEmail(customer.email) : null
    if (!email) {
      throw new BadRequestException('auth.emailVerification.emailRequired')
    }
    if (customer.emailVerifiedAt) {
      throw new ConflictException('auth.emailVerification.alreadyVerified')
    }

    const ipAddress = req?.ip ?? null
    const userAgent = (req?.headers['user-agent'] as string | undefined) ?? null
    const token = randomBytes(48).toString('hex')
    const tokenHash = hashSha256(token)
    const expiresAt = this.nowPlus(this.emailVerificationTtlMs)

    await this.prisma.customerEmailVerificationToken.updateMany({
      where: {
        customerId,
        usedAt: null,
      },
      data: {
        expiresAt: new Date(),
      },
    })

    await this.prisma.customerEmailVerificationToken.create({
      data: {
        customerId,
        tokenHash,
        emailSnapshot: email,
        expiresAt,
        ipAddress,
        userAgent,
      },
    })

    await this.email.sendEmailVerification({
      email,
      displayName: this.resolveDisplayName(customer),
      locale: (customer as { preferredLocale?: string | null }).preferredLocale ?? 'es',
      verificationUrl: this.buildEmailVerificationUrl(token),
      expiresAt,
    })
  }

  async verifyEmailToken(token: string): Promise<Customer> {
    const trimmedToken = token.trim()
    if (!trimmedToken) {
      throw new BadRequestException('auth.emailVerification.invalidToken')
    }

    const tokenHash = hashSha256(trimmedToken)
    const record = await this.prisma.customerEmailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        customer: true,
      },
    })

    if (!record?.customer) {
      throw new BadRequestException('auth.emailVerification.invalidToken')
    }

    if (!record.customer.email || normalizeEmail(record.customer.email) !== normalizeEmail(record.emailSnapshot)) {
      throw new BadRequestException('auth.emailVerification.invalidToken')
    }

    const verifiedAt = new Date()
    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: record.customerId },
        data: { emailVerifiedAt: verifiedAt },
      }),
      this.prisma.customerEmailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: verifiedAt },
      }),
      this.prisma.customerEmailVerificationToken.updateMany({
        where: {
          customerId: record.customerId,
          usedAt: null,
          id: { not: record.id },
        },
        data: { expiresAt: verifiedAt },
      }),
    ])

    return this.requireCustomer(record.customerId)
  }

  async reauthenticateWithPassword(customerId: number, password: string, req: FastifyRequest): Promise<ReauthTokenRecord> {
    const customer = await this.requireCustomer(customerId)
    if (!customer.passwordHash) {
      throw new BadRequestException('auth.passwordChange.passwordNotSet')
    }
    const matches = await bcrypt.compare(password, customer.passwordHash)
    if (!matches) {
      await this.logSecurityEvent(customerId, CustomerSecurityEventType.REAUTH_FAILED, {
        channel: 'password',
        ipAddress: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      })
      throw new UnauthorizedException('auth.passwordChange.invalidCredentials')
    }

    const token = await this.createReauthToken(customerId, CustomerReauthMethod.PASSWORD, {}, req.ip ?? null, (req.headers['user-agent'] as string | undefined) ?? null)
    await this.logSecurityEvent(customerId, CustomerSecurityEventType.REAUTH_COMPLETED, {
      channel: 'password',
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    })
    return token
  }

  async reauthenticateWithGoogle(
    customerId: number,
    factors: Record<string, unknown>,
    context: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<ReauthTokenRecord> {
    const token = await this.createReauthToken(
      customerId,
      CustomerReauthMethod.GOOGLE,
      factors,
      context.ipAddress ?? null,
      context.userAgent ?? null,
    )
    await this.logSecurityEvent(customerId, CustomerSecurityEventType.REAUTH_COMPLETED, {
      channel: 'google',
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })
    return token
  }

  async consumeReauthToken(customerId: number, token: string, allowedMethods: CustomerReauthMethod[]): Promise<void> {
    const hash = hashSha256(token.trim())
    const record = await this.prisma.customerReauthToken.findFirst({
      where: {
        tokenHash: hash,
        customerId,
        usedAt: null,
        expiresAt: { gt: new Date() },
        method: { in: allowedMethods },
      },
    })

    if (!record) {
      throw new UnauthorizedException('auth.passwordChange.reauthRequired')
    }

    await this.prisma.customerReauthToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })
  }

  async changePassword(
    customerId: number,
    newPassword: string,
    options: { reauthToken: string | null; keepSession?: boolean },
    req: FastifyRequest,
  ): Promise<Customer> {
    this.validatePassword(newPassword)

    if (!options.reauthToken) {
      throw new UnauthorizedException('auth.passwordChange.reauthRequired')
    }

    await this.consumeReauthToken(customerId, options.reauthToken, [
      CustomerReauthMethod.PASSWORD,
      CustomerReauthMethod.GOOGLE,
      CustomerReauthMethod.OTP,
    ])

    const customer = await this.requireCustomer(customerId)
    await this.performPasswordUpdate(customer, newPassword, {
      method: 'change',
      keepSession: options.keepSession ?? false,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    })

    await this.logSecurityEvent(customerId, CustomerSecurityEventType.PASSWORD_CHANGE, {
      channel: 'self-service',
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    })

    return this.requireCustomer(customerId)
  }

  async revokeAllSessions(customerId: number, reason: CustomerSecurityEventType, metadata?: Record<string, unknown>) {
    const newVersion = this.rotateSessionVersion()
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { storefrontSessionVersion: newVersion },
    })
    await this.logSecurityEvent(customerId, reason, {
      channel: 'system',
      metadata: (metadata ?? null) as Prisma.InputJsonValue | null,
    })
  }

  private async performPasswordUpdate(
    customer: Customer,
    newPassword: string,
    context: { method: 'email' | 'phone' | 'change'; keepSession?: boolean; ipAddress?: string | null; userAgent?: string | null },
  ) {
    const passwordHash = await bcrypt.hash(newPassword, 12)
    const newVersion = context.keepSession ? customer.storefrontSessionVersion : this.rotateSessionVersion()

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordHash,
        storefrontDefaultPasswordHash: null,
        passwordAlgorithm: 'bcrypt',
        passwordAlgVersion: 12,
        passwordUpdatedAt: new Date(),
        storefrontSessionVersion: newVersion,
      },
    })

    await this.prisma.customerReauthToken.updateMany({
      where: {
        customerId: customer.id,
        usedAt: null,
      },
      data: { expiresAt: new Date() },
    })

    await this.prisma.customerOtpChallenge.updateMany({
      where: {
        customerId: customer.id,
        consumedAt: null,
      },
      data: { expiresAt: new Date() },
    })

    await this.email.sendPasswordReset({
      email: customer.email ?? '',
      resetUrl: this.buildSecurityAlertUrl(),
      displayName: this.resolveDisplayName(customer),
      locale: null,
      isAdmin: false,
      event: 'password_changed',
    })

    await this.logSecurityEvent(customer.id, CustomerSecurityEventType.SESSION_REVOKED, {
      channel: context.method,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })
  }

  private async enforceRateLimit(target: RateLimitTarget) {
    const windowStart = this.nowPlus(-this.resetRateLimitWindowMs)

    const identifierPromise = target.identifierHash
      ? this.prisma.passwordResetToken.count({
          where: {
            targetIdentifierHash: target.identifierHash,
            createdAt: { gte: windowStart },
          },
        })
      : Promise.resolve(0)

    const ipPromise = target.ipAddress
      ? this.prisma.passwordResetToken.count({
          where: {
            ipAddress: target.ipAddress,
            createdAt: { gte: windowStart },
          },
        })
      : Promise.resolve(0)

    const [identifierCount, ipCount] = await Promise.all([identifierPromise, ipPromise])

    if (target.identifierHash && identifierCount >= this.resetRateLimitPerIdentifier) {
      throw new UnauthorizedException('auth.passwordRecovery.tooManyRequests')
    }
    if (target.ipAddress && ipCount >= this.resetRateLimitPerIp) {
      throw new UnauthorizedException('auth.passwordRecovery.tooManyRequests')
    }
  }

  private async enforceOtpRateLimit(phone: string, ipAddress: string | null) {
    const windowStart = this.nowPlus(-this.resetRateLimitWindowMs)

    const phoneCountPromise = this.prisma.customerOtpChallenge.count({
      where: {
        phone,
        createdAt: { gte: windowStart },
      },
    })

    const ipCountPromise = ipAddress
      ? this.prisma.customerOtpChallenge.count({
          where: {
            ipAddress,
            createdAt: { gte: windowStart },
          },
        })
      : Promise.resolve(0)

    const [phoneCount, ipCount] = await Promise.all([phoneCountPromise, ipCountPromise])

    if (phoneCount >= this.otpRateLimitPerPhone) {
      throw new UnauthorizedException('auth.passwordRecovery.tooManyRequests')
    }
    if (ipAddress && ipCount >= this.otpRateLimitPerIp) {
      throw new UnauthorizedException('auth.passwordRecovery.tooManyRequests')
    }
  }

  private async deliverOtp(phone: string, otp: string) {
    // TODO: integrate with SMS/WhatsApp providers. For now, log for observability.
    const maskedPhone = phone.length > 4 ? `${phone.slice(0, -4).replace(/\d/g, '*')}${phone.slice(-4)}` : phone
    this.logger.debug(`Dispatching password recovery OTP to ${maskedPhone}`)
  }

  private async markOtpFailed(challenge: CustomerOtpChallenge, ipAddress: string | null, userAgent: string | null, reason: string) {
    await this.logSecurityEvent(challenge.customerId, CustomerSecurityEventType.OTP_FAILED, {
      channel: 'phone',
      ipAddress,
      userAgent,
      metadata: { reason } as Prisma.InputJsonValue,
    })
  }

  private buildResetUrl(token: string) {
    const base = this.config.get<string>('STOREFRONT_BASE_URL') ?? ''
    if (!base) {
      return `https://example.com/reset-password?token=${encodeURIComponent(token)}`
    }
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base
    return `${normalized}/reset-password?token=${encodeURIComponent(token)}`
  }

  private buildSecurityAlertUrl() {
    const base = this.config.get<string>('STOREFRONT_BASE_URL') ?? ''
    if (!base) {
      return 'https://example.com/support/security'
    }
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base
    return `${normalized}/account/security`
  }

  private buildEmailVerificationUrl(token: string) {
    const base = this.config.get<string>('STOREFRONT_BASE_URL') ?? ''
    if (!base) {
      return `https://example.com/account/verify-email?token=${encodeURIComponent(token)}`
    }
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base
    return `${normalized}/account/verify-email?token=${encodeURIComponent(token)}`
  }

  private validatePassword(password: string) {
    if (typeof password !== 'string') {
      throw new BadRequestException('auth.passwordRecovery.invalidPassword')
    }
    const trimmed = password.trim()
    if (trimmed.length < PASSWORD_MIN_LENGTH || trimmed.length > PASSWORD_MAX_LENGTH) {
      throw new BadRequestException('auth.passwordRecovery.invalidPassword')
    }
    const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s+/g, '').split(''))
    if (uniqueChars.size < 4) {
      throw new BadRequestException('auth.passwordRecovery.passwordTooWeak')
    }
    const common = ['password', 'contraseña', '123456', 'qwerty', 'admin', 'storefront', 'ecommerce']
    if (common.includes(trimmed.toLowerCase())) {
      throw new BadRequestException('auth.passwordRecovery.passwordTooCommon')
    }
  }

  private generateOtp(): string {
    const min = Math.pow(10, OTP_LENGTH - 1)
    const max = Math.pow(10, OTP_LENGTH) - 1
    return String(randomInt(min, max)).padStart(OTP_LENGTH, '0')
  }

  private async createReauthToken(
    customerId: number,
    method: CustomerReauthMethod,
    factors: Record<string, unknown>,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<ReauthTokenRecord> {
    const token = randomBytes(48).toString('hex')
    const tokenHash = hashSha256(token)
    const expiresAt = this.nowPlus(this.reauthTokenTtlMs)

    await this.prisma.customerReauthToken.create({
      data: {
        customerId,
        tokenHash,
        method,
        factors: factors as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
        expiresAt,
      },
    })

    await this.logSecurityEvent(customerId, CustomerSecurityEventType.REAUTH_STARTED, {
      channel: method.toLowerCase(),
      ipAddress,
      userAgent,
    })

    return { token, expiresAt }
  }

  private async logSecurityEvent(
    customerId: number | null,
    eventType: CustomerSecurityEventType,
    context: { channel?: string | null; ipAddress?: string | null; userAgent?: string | null; metadata?: Prisma.InputJsonValue | null },
  ) {
    const metadataValue =
      context.metadata === null
        ? Prisma.JsonNull
        : context.metadata === undefined
          ? undefined
          : context.metadata
    await this.prisma.customerSecurityEvent.create({
      data: {
        customerId: customerId ?? undefined,
        eventType,
        channel: context.channel ?? null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        metadata: metadataValue,
      },
    })
  }

  private async requireCustomer(id: number): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
    if (!customer) {
      throw new NotFoundException('auth.passwordRecovery.customerNotFound')
    }
    return customer
  }

  private resolveDisplayName(customer: Customer): string {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    if (name) return name
    return customer.email ?? customer.phoneNumber ?? 'Customer'
  }

  private rotateSessionVersion(): number {
    return randomInt(1, 2_147_483_646)
  }

  private nowPlus(offsetMs: number): Date {
    return new Date(Date.now() + offsetMs)
  }
}
