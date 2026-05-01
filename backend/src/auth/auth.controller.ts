import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SignInDto } from './dto/sign-in.dto'
import { SignUpDto } from './dto/sign-up.dto'
import * as bcrypt from 'bcrypt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CookieSerializeOptions } from '@fastify/cookie'
import { resolveAvatarPublicUrl } from '../common/uploads/avatar'
import { PrismaService } from '../prisma/prisma.service'
import { UserActivityService } from '../user-activity/user-activity.service'
import { SESSION_TTL_SECONDS } from './auth.config'
import { PasswordResetService } from './password-reset.service'
import { PasswordResetConfirmDto, PasswordResetRequestDto } from './dto/password-reset.dto'
import { Throttle } from '@nestjs/throttler'
import { GoogleConfigService } from '../common/integrations/google-config.service'
import { PhoneAuthService } from './phone-auth.service'
import { resolveMediaProvider } from '../common/media/media-provider'
import {
  RecoverAccountDto,
  RegisterPhoneDto,
  ResetPasswordDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/phone-auth.dto'

@Controller()
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private userActivity: UserActivityService,
    private passwordReset: PasswordResetService,
    private readonly googleConfig: GoogleConfigService,
    private readonly phoneAuth: PhoneAuthService,
  ) {}

  private buildAuthCookieOptions(): CookieSerializeOptions {
    const secure = process.env.NODE_ENV !== 'development'
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    }
  }

  @Post('/sign-in')
  async signIn(
    @Body() dto: SignInDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.verifyRecaptcha(dto.recaptchaToken, req.ip)
    const user = await this.auth.validateUser(dto.email, dto.password)
    await this.userActivity.recordLogin(user.id, req)
    const result = await this.auth.signToken(user)
    reply.setCookie('access_token', result.token, this.buildAuthCookieOptions())
    return {
      ...result,
      user: {
        ...result.user,
        avatar: resolveAvatarPublicUrl(req, result.user.avatar),
      },
    }
  }

  @Post('/sign-up')
  async signUp(
    @Body() dto: SignUpDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase()
    const normalizedName = dto.name.trim()
    const normalizedLastName =
      dto.lastName !== undefined && dto.lastName !== null
        ? dto.lastName.trim()
        : undefined

    const exists = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    })
    if (!exists) {
      await this.prisma.user.create({
        data: {
          name: normalizedName,
          lastName: normalizedLastName,
          email: normalizedEmail,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: 'USER',
        },
      })
    }
    const user = await this.auth.validateUser(normalizedEmail, dto.password)
    const result = await this.auth.signToken(user)
    await this.userActivity.recordLogin(user.id, req)
    reply.setCookie('access_token', result.token, this.buildAuthCookieOptions())
    return {
      ...result,
      user: {
        ...result.user,
        avatar: resolveAvatarPublicUrl(req, result.user.avatar),
      },
    }
  }

  @Get('/auth/config')
  async getAuthConfig() {
    const config = await this.googleConfig.getEffectiveConfig()
    const adminRecaptchaEnabled = config.recaptcha.admin.enabled && Boolean(config.recaptcha.admin.siteKey)
    return {
      recaptcha: {
        enabled: adminRecaptchaEnabled,
        siteKey: adminRecaptchaEnabled ? config.recaptcha.admin.siteKey : null,
      },
      google: {
        enabled: config.google.enabled && Boolean(config.google.clientId) && Boolean(config.google.clientSecret),
      },
      media: {
        provider: resolveMediaProvider(),
      },
    }
  }

  @Get('/auth/session')
  async getSession(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = req.cookies?.access_token
    if (!token) {
      return null
    }

    const result = await this.auth.resolveSession(token)
    if (!result) {
      reply.clearCookie('access_token', { path: '/' })
      return null
    }

    return {
      ...result,
      user: {
        ...result.user,
        avatar: resolveAvatarPublicUrl(req, result.user.avatar),
      },
    }
  }

  // Stubs to satisfy UI flows
  @Post('/sign-out')
  async signOut(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie('access_token', { path: '/' })
    return { ok: true }
  }

  @Post('/auth/password/reset/request')
  @Throttle({ default: { limit: 5, ttl: 300 } })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: FastifyRequest) {
    await this.passwordReset.requestReset(dto.email, req)
    return { ok: true }
  }

  @Post('/auth/password/reset/confirm')
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto, @Req() req: FastifyRequest) {
    await this.passwordReset.resetPassword(dto.token, dto.password, req)
    return { ok: true }
  }

  @Post('/forgot-password')
  @Throttle({ default: { limit: 5, ttl: 300 } })
  async legacyForgotPassword(@Body() dto: PasswordResetRequestDto, @Req() req: FastifyRequest) {
    await this.passwordReset.requestReset(dto.email, req)
    return { ok: true }
  }

  @Post('/reset-password')
  async legacyResetPassword(@Body() dto: PasswordResetConfirmDto, @Req() req: FastifyRequest) {
    await this.passwordReset.resetPassword(dto.token, dto.password, req)
    return { ok: true }
  }

  @Post('/auth/register')
  async registerWithPhone(@Body() dto: RegisterPhoneDto, @Req() req: FastifyRequest) {
    return this.phoneAuth.register(dto, req)
  }

  @Post('/auth/send-otp')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: FastifyRequest) {
    return this.phoneAuth.sendOtp(dto, req)
  }

  @Post('/auth/verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: FastifyRequest) {
    return this.phoneAuth.verifyOtp(dto, req)
  }

  @Post('/auth/recover')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async recover(@Body() dto: RecoverAccountDto, @Req() req: FastifyRequest) {
    return this.phoneAuth.recover(dto, req)
  }

  @Post('/auth/reset-password')
  async resetPasswordPhoneAuth(@Body() dto: ResetPasswordDto, @Req() req: FastifyRequest) {
    return this.phoneAuth.resetPassword(dto, req)
  }
}
