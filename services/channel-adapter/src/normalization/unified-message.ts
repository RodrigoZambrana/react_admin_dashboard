export type UnifiedChannel =
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'webchat'
  | 'email'
  | 'admin_chat'

export type UnifiedScope =
  | 'customer_public'
  | 'customer_authenticated'
  | 'admin_internal'

export type UnifiedRole =
  | 'customer_public'
  | 'customer_authenticated'
  | 'admin_support'
  | 'admin_sales'
  | 'admin_operations'
  | 'admin_supervisor'
  | 'superadmin'

export type UnifiedAuthLevel = 'anonymous' | 'customer' | 'admin'

export type UnifiedMessage = {
  channel: UnifiedChannel
  tenantKey: string
  userId: string
  scope: UnifiedScope
  role?: UnifiedRole
  text: string
  messageId?: string
  conversationId?: string
  inboxId?: string
  authLevel?: UnifiedAuthLevel
  authRole?: string
  authRoles?: string[]
  capabilityGroups?: string[]
  directCapabilities?: string[]
  capabilityEnvelope?: string[]
  authenticated?: boolean
  attachments?: Array<{
    assetType?: string
    fileName?: string
    contentType?: string
    content?: string
    textContent?: string
    metadata?: Record<string, unknown>
  }>
  metadata?: Record<string, unknown>
}
