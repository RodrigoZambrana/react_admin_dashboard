import { Injectable, Logger } from '@nestjs/common'
import { SmsProvider } from './sms-provider'

type TwilioProviderOptions = {
  accountSid: string
  authToken: string
  from?: string | null
  messagingServiceSid?: string | null
  baseUrl?: string
}

@Injectable()
export class TwilioProvider implements SmsProvider {
  readonly name = 'twilio'
  private readonly logger = new Logger(TwilioProvider.name)
  private readonly accountSid: string
  private readonly authToken: string
  private readonly from: string | null
  private readonly messagingServiceSid: string | null
  private readonly baseUrl: string

  constructor(options: TwilioProviderOptions) {
    this.accountSid = options.accountSid
    this.authToken = options.authToken
    this.from = options.from ?? null
    this.messagingServiceSid = options.messagingServiceSid ?? null
    this.baseUrl = (options.baseUrl ?? 'https://api.twilio.com').replace(/\/$/, '')
  }

  async sendSms(to: string, message: string): Promise<void> {
    const body = new URLSearchParams()
    body.set('To', to)
    body.set('Body', message)
    if (this.messagingServiceSid) {
      body.set('MessagingServiceSid', this.messagingServiceSid)
    } else if (this.from) {
      body.set('From', this.from)
    } else {
      throw new Error('Twilio SMS provider requires TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID.')
    }

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')
    const response = await fetch(`${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string; code?: number } | null
      const reason = payload?.message ?? `HTTP ${response.status}`
      this.logger.error(`Twilio SMS send failed for ${to}: ${reason}`)
      throw new Error(`Twilio SMS send failed: ${reason}`)
    }
  }
}

