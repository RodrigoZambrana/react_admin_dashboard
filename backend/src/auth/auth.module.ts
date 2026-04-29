import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'
import { AuthController } from './auth.controller'
import { UserActivityModule } from '../user-activity/user-activity.module'
import { SESSION_TTL_SECONDS } from './auth.config'
import { PasswordResetService } from './password-reset.service'
import { EmailModule } from '../email/email.module'
import { resolveRequiredEnv } from '../common/config/runtime-env'
import { UserManagementPolicyService } from './user-management-policy'
import { PhoneAuthService } from './phone-auth.service'
import { SmsProviderFactory } from './sms/sms-provider.factory'
import { SmsTemplateService } from './sms/sms-template.service'
import { AuthAuditService } from './auth-audit.service'
import { OtpRateLimitService } from './otp-rate-limit.service'

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: resolveRequiredEnv('JWT_SECRET', {
        developmentFallback: 'local-dev-jwt-secret-change-me',
      }),
      signOptions: { expiresIn: SESSION_TTL_SECONDS },
    }),
    UserActivityModule,
    EmailModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordResetService,
    UserManagementPolicyService,
    PhoneAuthService,
    SmsProviderFactory,
    SmsTemplateService,
    AuthAuditService,
    OtpRateLimitService,
  ],
  controllers: [AuthController],
  exports: [UserManagementPolicyService],
})
export class AuthModule {}
