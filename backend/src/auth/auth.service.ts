import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(userName: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { userName } })
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
  }) {
    const payload = {
      sub: user.id,
      userName: user.userName,
      email: user.email,
      authority: [user.role],
      avatar: user.img || '',
      role: user.role,
    }
    const token = this.jwt.sign(payload)
    return {
      token,
      user: {
        userName: user.userName,
        authority: [user.role],
        avatar: user.img || '',
        email: user.email,
      },
    }
  }
}

