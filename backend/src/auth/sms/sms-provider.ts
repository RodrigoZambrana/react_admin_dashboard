export interface SmsProvider {
  name: string
  sendSms(to: string, message: string): Promise<void>
}
