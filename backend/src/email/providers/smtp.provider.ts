import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { EmailMessage, EmailProviderSendResult } from '../email.types'
import { EmailProvider } from './email-provider'

export type SmtpEmailProviderOptions = {
  host: string
  port: number
  secure: boolean
  user?: string
  password?: string
  pool?: boolean
  allowInvalidCerts?: boolean
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp'
  private transporter: nodemailer.Transporter

  constructor(private readonly options: SmtpEmailProviderOptions) {
    const smtpOptions: SMTPTransport.Options = {
      host: options.host,
      port: options.port,
      secure: options.secure,
      pool: options.pool ?? true,
      auth:
        options.user && options.password
          ? {
              user: options.user,
              pass: options.password,
            }
          : undefined,
      tls: options.allowInvalidCerts
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    }
    this.transporter = nodemailer.createTransport(smtpOptions)
  }

  async verify() {
    await this.transporter.verify()
  }

  async send(message: EmailMessage): Promise<EmailProviderSendResult> {
    const { recipients, from, cc, bcc, subject, html, text } = message
    if (!recipients.length) {
      throw new Error('Email requires at least one recipient')
    }
    const toList = recipients.map((recipient) =>
      recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email,
    )
    const info = await this.transporter.sendMail({
      from: from.name ? `"${from.name}" <${from.email}>` : from.email,
      to: toList,
      cc: cc && cc.length ? cc : undefined,
      bcc: bcc && bcc.length ? bcc : undefined,
      subject,
      html,
      text,
      headers: {
        'X-Email-Category': message.category,
        'X-Email-Variant': message.variant,
        'X-Email-Locale': message.locale,
      },
    })
    return { messageId: info.messageId }
  }
}
