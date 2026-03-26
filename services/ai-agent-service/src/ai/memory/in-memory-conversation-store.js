export class InMemoryConversationStore {
  constructor() {
    this.snapshots = new Map()
  }

  async get(conversationId) {
    return this.snapshots.get(conversationId) ?? null
  }

  async appendTurn(conversationId, turn, scope = 'customer_public', role = scope) {
    const current =
      (await this.get(conversationId)) ?? {
        conversationId,
        scope,
        role,
        turns: [],
        summary: null,
        compiledContext: null,
        taskState: null,
        updatedAt: new Date().toISOString(),
      }

    current.scope = scope
    current.role = role
    current.turns.push(turn)
    current.updatedAt = new Date().toISOString()
    this.snapshots.set(conversationId, current)
  }

  async replace(conversationId, snapshot) {
    this.snapshots.set(conversationId, snapshot)
  }

  async clear(conversationId) {
    this.snapshots.delete(conversationId)
  }
}
