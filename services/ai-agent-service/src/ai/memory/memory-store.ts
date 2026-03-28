export type MemoryScope =
  | 'customer_public'
  | 'customer_authenticated'
  | 'admin_internal'

export type MemoryRole =
  | 'customer_public'
  | 'customer_authenticated'
  | 'admin_support'
  | 'admin_sales'
  | 'admin_operations'
  | 'admin_supervisor'
  | 'superadmin'

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
  role: MemoryRole
  turns: MemoryTurn[]
  summary?: string | null
  compiledContext?: string | null
  taskState?: {
    taskId: string
    intentKey: string
    state?: string | null
    stateHistory?: string[]
    lastTransitionAt?: string | null
    topicTokens: string[]
    taskSummary?: string | null
    currentTask?: {
      intentKey: string
      entities: Array<{ type: string; value: string }>
      status: string
      lastUpdate: string
    } | null
    resetCount: number
    lastResetAt?: string | null
    updatedAt: string
  } | null
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
