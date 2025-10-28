import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'
import { AuthController } from './auth.controller'
import { UserActivityModule } from '../user-activity/user-activity.module'
import { SESSION_TTL_SECONDS } from './auth.config'
import { PasswordResetService } from './password-reset.service'
import { EmailModule } from '../email/email.module'

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: SESSION_TTL_SECONDS },
    }),
    UserActivityModule,
    EmailModule,
  ],
  providers: [AuthService, JwtStrategy, PasswordResetService],
  controllers: [AuthController],
})
export class AuthModule {}
