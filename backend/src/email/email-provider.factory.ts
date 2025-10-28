import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailProvider } from './providers/email-provider'
import { SmtpEmailProvider } from './providers/smtp.provider'
import { DevEmailProvider } from './providers/dev.provider'
import { SendGridEmailProvider } from './providers/sendgrid.provider'

export type EmailProviderType = 'SMTP' | 'SENDGRID' | 'DEV'

@Injectable()
export class EmailProviderFactory {
  private readonly logger = new Logger(EmailProviderFactory.name)
  private cachedProvider: EmailProvider | null = null

  constructor(private readonly config: ConfigService) {}

  getProvider(): EmailProvider {
    if (this.cachedProvider) {
      return this.cachedProvider
    }
    const providerType = (this.config.get<string>('EMAIL_PROVIDER') || 'DEV').toUpperCase() as EmailProviderType
    this.logger.log(`Initializing email provider: ${providerType}`)
    switch (providerType) {
      case 'SMTP': {
        const host = this.config.get<string>('EMAIL_SMTP_HOST') ?? ''
        const port = Number(this.config.get<string>('EMAIL_SMTP_PORT') ?? '587')
        const secure = (this.config.get<string>('EMAIL_SMTP_SECURE') ?? 'false').toLowerCase() === 'true'
        const user = this.config.get<string>('EMAIL_SMTP_USER') ?? undefined
        const password = this.config.get<string>('EMAIL_SMTP_PASSWORD') ?? undefined
        if (!host) {
          throw new Error('EMAIL_SMTP_HOST is required when EMAIL_PROVIDER=SMTP')
        }
        this.cachedProvider = new SmtpEmailProvider({
          host,
          port,
          secure,
          user,
          password,
          allowInvalidCerts: (this.config.get<string>('EMAIL_SMTP_ALLOW_INVALID_CERTS') ?? 'false').toLowerCase() === 'true',
        })
        break
      }
      case 'SENDGRID': {
        const apiKey = this.config.get<string>('SENDGRID_API_KEY')
        if (!apiKey) {
          throw new Error('SENDGRID_API_KEY is required when EMAIL_PROVIDER=SENDGRID')
        }
        this.cachedProvider = new SendGridEmailProvider({ apiKey })
        break
      }
      case 'DEV':
      default: {
        const outputDir = this.config.get<string>('EMAIL_DEV_OUTPUT_DIR') ?? undefined
        this.cachedProvider = new DevEmailProvider({ outputDir })
        break
      }
    }
    return this.cachedProvider
  }
}
