import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { EmailMessage, EmailProviderSendResult } from '../email.types'
import { EmailProvider } from './email-provider'

export type DevEmailProviderOptions = {
  outputDir?: string
}

export class DevEmailProvider implements EmailProvider {
  readonly name = 'dev'
  private readonly outputDir: string

  constructor(opts: DevEmailProviderOptions = {}) {
    this.outputDir = opts.outputDir || join(process.cwd(), 'tmp/email-previews')
  }

  async send(message: EmailMessage): Promise<EmailProviderSendResult> {
    await mkdir(this.outputDir, { recursive: true })
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const fileName = `${timestamp}_${message.category}_${message.variant}_${randomUUID()}.eml`
    if (!message.recipients.length) {
      throw new Error('Email requires at least one recipient')
    }
    const toHeader = message.recipients
      .map((recipient) => (recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email))
      .join(', ')
    const headers = [
      `From: ${message.from.name ? `"${message.from.name}" <${message.from.email}>` : message.from.email}`,
      message.replyTo ? `Reply-To: ${message.replyTo}` : null,
      `To: ${toHeader}`,
      message.cc && message.cc.length ? `Cc: ${message.cc.join(', ')}` : null,
      message.bcc && message.bcc.length ? `Bcc: ${message.bcc.join(', ')}` : null,
      `Subject: ${message.subject}`,
      `X-Email-Category: ${message.category}`,
      `X-Email-Variant: ${message.variant}`,
      `X-Email-Locale: ${message.locale}`,
      '',
    ]
      .filter(Boolean)
      .join('\n')
    const extraHeaders: string[] = []
    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        extraHeaders.push(`${key}: ${value}`)
      }
    }
    const headerBlock = [headers, ...extraHeaders].filter(Boolean).join('\n')
    const emlContent = `${headerBlock}\n${message.html}`
    const filePath = join(this.outputDir, fileName)
    await writeFile(filePath, emlContent, 'utf8')
    return { messageId: filePath }
  }
}
