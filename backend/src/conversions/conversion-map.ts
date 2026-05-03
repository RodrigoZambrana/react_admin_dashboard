export type CanonicalConversionName = 'purchase' | 'generate_lead' | 'contact'

export type ConversionMapEntry = {
  internalEventNames: string[]
  canonicalName: CanonicalConversionName
  businessType: 'ecommerce' | 'lead'
  requiresTransactionId: boolean
  requiresContactEvidence: boolean
  requiresValue: boolean
  recommendedSource: 'backend' | 'hybrid'
}

const PURCHASE_ENTRY: ConversionMapEntry = {
  internalEventNames: ['purchase', 'purchase_completed'],
  canonicalName: 'purchase',
  businessType: 'ecommerce',
  requiresTransactionId: true,
  requiresContactEvidence: false,
  requiresValue: true,
  recommendedSource: 'backend',
}

const LEAD_ENTRY: ConversionMapEntry = {
  internalEventNames: ['form_submit', 'lead_created', 'lead_form_submit', 'email_submit'],
  canonicalName: 'generate_lead',
  businessType: 'lead',
  requiresTransactionId: false,
  requiresContactEvidence: true,
  requiresValue: false,
  recommendedSource: 'hybrid',
}

const CONTACT_ENTRY: ConversionMapEntry = {
  internalEventNames: ['whatsapp_click', 'phone_click'],
  canonicalName: 'contact',
  businessType: 'lead',
  requiresTransactionId: false,
  requiresContactEvidence: false,
  requiresValue: false,
  recommendedSource: 'hybrid',
}

export const CONVERSION_MAP: ConversionMapEntry[] = [PURCHASE_ENTRY, LEAD_ENTRY, CONTACT_ENTRY]

export const resolveConversionMapEntry = (eventName: string | null | undefined) => {
  if (!eventName) {
    return null
  }
  const normalized = eventName.trim().toLowerCase()
  return (
    CONVERSION_MAP.find((entry) =>
      entry.internalEventNames.some((candidate) => candidate.toLowerCase() === normalized),
    ) ?? null
  )
}

