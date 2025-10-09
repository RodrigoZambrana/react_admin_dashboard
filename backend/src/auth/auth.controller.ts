import { Body, Controller, Post, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SignInDto } from './dto/sign-in.dto'
import { SignUpDto } from './dto/sign-up.dto'
import * as bcrypt from 'bcrypt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CookieSerializeOptions } from '@fastify/cookie'
import { resolveAvatarPublicUrl } from '../common/uploads/avatar'
import { PrismaService } from '../prisma/prisma.service'
import { UserActivityService } from '../user-activity/user-activity.service'

@Controller()
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private userActivity: UserActivityService,
  ) {}

  private buildAuthCookieOptions(): CookieSerializeOptions {
    const secure = process.env.NODE_ENV !== 'development'
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
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
    const result = this.auth.signToken(user)
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
    const result = this.auth.signToken(user)
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

  // Stubs to satisfy UI flows
  @Post('/sign-out')
  async signOut(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie('access_token', { path: '/' })
    return { ok: true }
  }

  @Post('/forgot-password')
  async forgotPassword() {
    return { ok: true }
  }

  @Post('/reset-password')
  async resetPassword() {
    return { ok: true }
  }
}
