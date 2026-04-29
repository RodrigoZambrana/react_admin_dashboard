import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SmsProvider } from './sms-provider'
import { TextbeeProvider } from './textbee.provider'
import { TwilioProvider } from './twilio.provider'

@Injectable()
export class SmsProviderFactory {
  private readonly logger = new Logger(SmsProviderFactory.name)
  private cachedProvider: SmsProvider | null = null

  constructor(private readonly config: ConfigService) {}

  getProvider(): SmsProvider {
    if (this.cachedProvider) {
      return this.cachedProvider
    }

    const provider = (this.config.get<string>('SMS_PROVIDER') ?? 'textbee').trim().toLowerCase()
    switch (provider) {
      case 'twilio': {
        const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID')
        const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN')
        if (!accountSid || !authToken) {
          throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when SMS_PROVIDER=twilio')
        }
        this.cachedProvider = new TwilioProvider({
          accountSid,
          authToken,
          from: this.config.get<string>('TWILIO_FROM') ?? null,
          messagingServiceSid: this.config.get<string>('TWILIO_MESSAGING_SERVICE_SID') ?? null,
          baseUrl: this.config.get<string>('TWILIO_API_BASE_URL') ?? undefined,
        })
        break
      }
      case 'textbee':
      default: {
        const apiKey = this.config.get<string>('TEXTBEE_API_KEY')
        const deviceId = this.config.get<string>('TEXTBEE_DEVICE_ID')
        if (!apiKey || !deviceId) {
          throw new Error('TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID are required when SMS_PROVIDER=textbee')
        }
        this.cachedProvider = new TextbeeProvider({
          apiKey,
          deviceId,
          baseUrl: this.config.get<string>('TEXTBEE_API_BASE_URL') ?? undefined,
        })
        break
      }
    }

    this.logger.log(`Initialized SMS provider: ${this.cachedProvider.name}`)
    return this.cachedProvider
  }

  reset() {
    this.cachedProvider = null
  }
}

