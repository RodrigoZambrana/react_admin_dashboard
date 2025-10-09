import { Body, Controller, Post, Req } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SignInDto } from './dto/sign-in.dto'
import { SignUpDto } from './dto/sign-up.dto'
import * as bcrypt from 'bcrypt'
import type { FastifyRequest } from 'fastify'
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

  @Post('/sign-in')
  async signIn(@Body() dto: SignInDto, @Req() req: FastifyRequest) {
    await this.auth.verifyRecaptcha(dto.recaptchaToken, req.ip)
    const user = await this.auth.validateUser(dto.userName, dto.password)
    await this.userActivity.recordLogin(user.id, req)
    const result = this.auth.signToken(user)
    return {
      ...result,
      user: {
        ...result.user,
        avatar: resolveAvatarPublicUrl(req, result.user.avatar),
      },
    }
  }

  @Post('/sign-up')
  async signUp(@Body() dto: SignUpDto, @Req() req: FastifyRequest) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ userName: dto.userName }, { email: dto.email }] },
    })
    if (!exists) {
      await this.prisma.user.create({
        data: {
          userName: dto.userName,
          name: dto.name,
          lastName: dto.lastName,
          email: dto.email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: 'USER',
        },
      })
    }
    const user = await this.auth.validateUser(dto.userName, dto.password)
    const result = this.auth.signToken(user)
    await this.userActivity.recordLogin(user.id, req)
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
  async signOut() {
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
