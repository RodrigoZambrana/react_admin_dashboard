import { EmailCategory, EmailRecipientType, EmailTemplateVariant, Role } from '@prisma/client'

export type EmailLocale = string

export type OrderEmailAddress = {
  line1?: string | null
  line2?: string | null
  department?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  lines: string[]
}

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
    phone?: string | null
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
  deliveryEstimateLabel?: string | null
  shippingVendor?: string | null
  shippingAddress?: OrderEmailAddress | null
  billingAddress?: OrderEmailAddress | null
  notes?: string | null
  locale: EmailLocale
}

export type PaymentEmailContext = {
  paymentId: number
  orderId: number
  orderNumber?: string | null
  amount: string
  amountRaw: number
  currency: string
  method?: string | null
  reference?: string | null
  status: string
  statusLabel?: string | null
  processedAt: string
  customer: {
    id: number
    name: string | null
    email: string
    phone?: string | null
    locale?: string | null
  }
  orderDate?: string | null
  orderStatus?: string | null
  orderStatusCode?: string | null
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
    grandTotal: string
    grandTotalRaw: number
    totalPaid: string
    totalPaidRaw: number
    remaining: string
    remainingRaw: number
    currency: string
  }
  isFullyPaid: boolean
  links?: {
    customer?: string | null
    admin?: string | null
  } | null
  locale: EmailLocale
  portalUrl?: string | null
  adminUrl?: string | null
}

export type PasswordResetEmailContext = {
  event: 'reset_link' | 'password_changed' | 'recovery_notice' | 'welcome' | 'verify_email'
  resetUrl?: string | null
  supportUrl?: string | null
  accountUrl?: string | null
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
