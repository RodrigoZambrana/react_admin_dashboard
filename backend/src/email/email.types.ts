import { EmailCategory, EmailRecipientType, EmailTemplateVariant, Role } from '@prisma/client'

export type EmailLocale = string

export type OrderEmailContext = {
  orderId: number
  orderNumber?: string | null
  orderDate: string
  status?: string | null
  customer: {
    id: number
    name: string | null
    email: string
    locale?: string | null
  }
  items: Array<{
    name: string
    quantity: number
    unitPrice: string
    subtotal: string
  }>
  totals: {
    subtotal: string
    tax?: string | null
    grandTotal: string
    currency: string
  }
  paymentUrl?: string | null
  portalUrl?: string | null
  locale: EmailLocale
}

export type PaymentEmailContext = {
  paymentId: number
  orderId: number
  orderNumber?: string | null
  amount: string
  currency: string
  method?: string | null
  status: string
  processedAt: string
  customer: {
    id: number
    name: string | null
    email: string
    locale?: string | null
  }
  locale: EmailLocale
  portalUrl?: string | null
}

export type PasswordResetEmailContext = {
  resetUrl: string
  expiresAt: string
  displayName: string
  locale: EmailLocale
  isAdmin: boolean
}

export type EmailRenderContext =
  | { category: 'ORDERS'; variant: EmailTemplateVariant; payload: OrderEmailContext }
  | { category: 'PAYMENTS'; variant: EmailTemplateVariant; payload: PaymentEmailContext }
  | { category: 'AUTH'; variant: EmailTemplateVariant; payload: PasswordResetEmailContext }

export type EmailRecipient = {
  email: string
  name?: string | null
  locale?: string | null
}

export type EmailMessage = {
  category: EmailCategory
  variant: EmailTemplateVariant
  locale: EmailLocale
  recipientType: EmailRecipientType
  recipients: EmailRecipient[]
  subject: string
  html: string
  text?: string
  cc?: string[]
  bcc?: string[]
  from: {
    email: string
    name?: string | null
  }
  payload: Record<string, unknown>
  templateId?: number | null
}

export type EmailProviderSendResult = {
  messageId?: string | null
}

export type RoleRuleInput = {
  role: Role
  categories: EmailCategory[]
  enabled: boolean
}
