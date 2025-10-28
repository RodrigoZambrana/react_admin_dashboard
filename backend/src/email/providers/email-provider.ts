import { EmailMessage, EmailProviderSendResult } from '../email.types'

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<EmailProviderSendResult>
  verify?(): Promise<void>
}
