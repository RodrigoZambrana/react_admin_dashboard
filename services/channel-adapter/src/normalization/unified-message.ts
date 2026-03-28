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

export type UnifiedAuthorKind =
  | 'customer_human'
  | 'business_human'
  | 'business_auto'
  | 'channel_system'
  | 'operator_human'
  | 'agent_runtime'
  | 'unknown'

export type UnifiedMessageKind =
  | 'human_message'
  | 'business_auto_reply'
  | 'channel_system'
  | 'attachment_only'
  | 'system_event'

export type UnifiedMessage = {
  channel: UnifiedChannel
  tenantKey: string
  userId: string
  scope: UnifiedScope
  role?: UnifiedRole
  text: string
  customerId?: number | null
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
  authorKind: UnifiedAuthorKind
  messageKind: UnifiedMessageKind
  attachments?: Array<{
    assetType?: string
    fileName?: string
    contentType?: string
    content?: string
    textContent?: string
    metadata?: Record<string, unknown>
  }>
  messageElements?: Array<Record<string, unknown>>
  metadata?: Record<string, unknown>
}
