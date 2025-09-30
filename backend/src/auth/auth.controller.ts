import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SignInDto } from './dto/sign-in.dto'
import { SignUpDto } from './dto/sign-up.dto'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

@Controller()
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('/sign-in')
  async signIn(@Body() dto: SignInDto) {
    const user = await this.auth.validateUser(dto.userName, dto.password)
    return this.auth.signToken(user)
  }

  @Post('/sign-up')
  async signUp(@Body() dto: SignUpDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ userName: dto.userName }, { email: dto.email }] },
    })
    if (!exists) {
      await this.prisma.user.create({
        data: {
          userName: dto.userName,
          name: dto.name,
          email: dto.email,
          passwordHash: await bcrypt.hash(dto.password, 10),
          role: 'USER',
        },
      })
    }
    const user = await this.auth.validateUser(dto.userName, dto.password)
    return this.auth.signToken(user)
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

