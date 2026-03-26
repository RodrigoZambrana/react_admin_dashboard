export type AgentRole =
  | 'customer_public'
  | 'customer_authenticated'
  | 'admin_support'
  | 'admin_sales'
  | 'admin_operations'
  | 'admin_supervisor'
  | 'superadmin'

export type AgentModelRequest = {
  role: AgentRole
  systemPrompt: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
  }>
  toolNames?: string[]
  temperature?: number
}

export type AgentModelResponse = {
  text: string
  toolCalls?: Array<{
    name: string
    arguments: Record<string, unknown>
  }>
  raw?: unknown
}

export interface ModelProvider {
  readonly providerName: string
  generate(request: AgentModelRequest): Promise<AgentModelResponse>
}
