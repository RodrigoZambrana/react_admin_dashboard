import { Injectable, Logger } from '@nestjs/common'
import { SmsProvider } from './sms-provider'

type TextbeeProviderOptions = {
  apiKey: string
  deviceId: string
  baseUrl?: string
}

@Injectable()
export class TextbeeProvider implements SmsProvider {
  readonly name = 'textbee'
  private readonly logger = new Logger(TextbeeProvider.name)
  private readonly apiKey: string
  private readonly deviceId: string
  private readonly baseUrl: string

  constructor(options: TextbeeProviderOptions) {
    this.apiKey = options.apiKey
    this.deviceId = options.deviceId
    this.baseUrl = (options.baseUrl ?? 'https://api.textbee.dev').replace(/\/$/, '')
  }

  async sendSms(to: string, message: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/gateway/devices/${this.deviceId}/send-sms`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: [to],
        message,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
      const reason = payload?.error ?? payload?.message ?? `HTTP ${response.status}`
      this.logger.error(`Textbee SMS send failed for ${to}: ${reason}`)
      throw new Error(`Textbee SMS send failed: ${reason}`)
    }
  }
}

