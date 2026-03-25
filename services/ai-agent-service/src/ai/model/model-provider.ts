export type AgentScope = 'customer_public' | 'admin_internal'

export type AgentModelRequest = {
  scope: AgentScope
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
