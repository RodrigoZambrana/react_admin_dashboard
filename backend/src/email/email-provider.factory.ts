import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailProvider } from './providers/email-provider'
import { SmtpEmailProvider } from './providers/smtp.provider'
import { DevEmailProvider } from './providers/dev.provider'
import { SendGridEmailProvider } from './providers/sendgrid.provider'
import { EmailSettingsService } from './email-settings.service'

export type EmailProviderType = 'SMTP' | 'SENDGRID' | 'DEV'

@Injectable()
export class EmailProviderFactory {
  private readonly logger = new Logger(EmailProviderFactory.name)
  private cachedProvider: EmailProvider | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

  async getProvider(): Promise<EmailProvider> {
    if (this.cachedProvider) {
      return this.cachedProvider
    }
    const providerConfig = await this.emailSettings.resolveEmailProviderConfig()
    this.logger.log(`Initializing email provider: ${providerConfig.provider}`)
    switch (providerConfig.provider) {
      case 'SMTP': {
        const smtp = providerConfig.smtp
        if (!smtp || !smtp.host) {
          throw new Error('SMTP configuration is incomplete. Host is required.')
        }
        this.cachedProvider = new SmtpEmailProvider({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user ?? undefined,
          password: smtp.password ?? undefined,
          allowInvalidCerts: smtp.allowInvalidCerts,
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

  reset() {
    this.cachedProvider = null
  }
}
