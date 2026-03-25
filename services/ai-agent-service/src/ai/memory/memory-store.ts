export type MemoryScope = 'customer_public' | 'admin_internal'

export type MemoryTurnRole = 'customer' | 'operator' | 'agent' | 'system'

export type MemoryTurn = {
  role: MemoryTurnRole
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export type ConversationMemorySnapshot = {
  conversationId: string
  scope: MemoryScope
  turns: MemoryTurn[]
  summary?: string | null
  compiledContext?: string | null
  updatedAt: string
}

export interface ConversationMemoryStore {
  get(conversationId: string): Promise<ConversationMemorySnapshot | null>
  appendTurn(conversationId: string, turn: MemoryTurn): Promise<void>
  replace(
    conversationId: string,
    snapshot: ConversationMemorySnapshot,
  ): Promise<void>
  clear(conversationId: string): Promise<void>
}

export interface ContextCacheStore {
  getCompiledContext(conversationId: string): Promise<string | null>
  setCompiledContext(
    conversationId: string,
    compiledContext: string,
    ttlSeconds?: number,
  ): Promise<void>
  invalidate(conversationId: string): Promise<void>
}
