import { EmailMessage, EmailProviderSendResult } from '../email.types'
import { EmailProvider } from './email-provider'

export type SendGridEmailProviderOptions = {
  apiKey: string
  mailSettings?: Record<string, unknown>
}

export class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid'

  constructor(private readonly options: SendGridEmailProviderOptions) {
    if (!options.apiKey) {
      throw new Error('SendGrid API key is required')
    }
  }

  async send(message: EmailMessage): Promise<EmailProviderSendResult> {
    const { recipients, from, cc, bcc, subject, html, text } = message
    if (!recipients.length) {
      throw new Error('Email requires at least one recipient')
    }
    const personalization: Record<string, unknown> = {
      to: recipients.map((recipient) => ({ email: recipient.email, name: recipient.name || undefined })),
    }
    if (cc && cc.length) {
      personalization.cc = cc.map((email) => ({ email }))
    }
    if (bcc && bcc.length) {
      personalization.bcc = bcc.map((email) => ({ email }))
    }
    const payload = {
      personalizations: [personalization],
      from: { email: from.email, name: from.name ?? undefined },
      subject,
      content: [
        ...(text ? [{ type: 'text/plain', value: text }] : []),
        { type: 'text/html', value: html },
      ],
      mail_settings: this.options.mailSettings ?? undefined,
      headers: {
        'X-Email-Category': message.category,
        'X-Email-Variant': message.variant,
        'X-Email-Locale': message.locale,
      },
    }
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`SendGrid API error: ${res.status} ${res.statusText} - ${errorBody}`)
    }
    const messageId = res.headers.get('x-message-id')
    return { messageId }
  }
}
