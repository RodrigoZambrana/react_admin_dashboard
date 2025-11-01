import { EmailCategory, EmailRecipientType, EmailTemplateVariant, Role } from '@prisma/client'

export type EmailLocale = string

export type OrderEmailContext = {
  orderId: number
  orderNumber?: string | null
  documentType: 'ORDER' | 'BUDGET'
  event: string
  orderDate: string
  status?: string | null
  statusCode?: string | null
  previousStatus?: string | null
  previousStatusCode?: string | null
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
    unitPriceRaw: number
    subtotal: string
    subtotalRaw: number
    description?: string | null
  }>
  totals: {
    subtotal: string
    subtotalRaw: number
    tax?: string | null
    taxRaw?: number | null
    grandTotal: string
    grandTotalRaw: number
    currency: string
  }
  paymentUrl?: string | null
  portalUrl?: string | null
  adminUrl?: string | null
  links?: {
    customer?: string | null
    admin?: string | null
    payment?: string | null
  } | null
  validUntil?: string | null
  paymentMethod?: string | null
  deliveryEstimate?: {
    minHours?: number | null
    maxHours?: number | null
  } | null
  notes?: string | null
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
  event: 'reset_link' | 'password_changed' | 'recovery_notice'
  resetUrl?: string | null
  supportUrl?: string | null
  expiresAt?: string | null
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
  replyTo?: string | null
  headers?: Record<string, string>
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
