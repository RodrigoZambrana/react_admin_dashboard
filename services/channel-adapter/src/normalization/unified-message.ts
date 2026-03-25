export type UnifiedChannel =
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'webchat'
  | 'email'
  | 'admin_chat'

export type UnifiedScope = 'customer_public' | 'admin_internal'

export type UnifiedAuthLevel = 'anonymous' | 'customer' | 'admin'

export type UnifiedMessage = {
  channel: UnifiedChannel
  tenantKey: string
  userId: string
  scope: UnifiedScope
  text: string
  messageId?: string
  conversationId?: string
  inboxId?: string
  authLevel?: UnifiedAuthLevel
  metadata?: Record<string, unknown>
}
