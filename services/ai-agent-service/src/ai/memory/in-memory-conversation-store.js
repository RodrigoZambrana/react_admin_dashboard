export class InMemoryConversationStore {
  constructor() {
    this.snapshots = new Map()
  }

  async get(conversationId) {
    return this.snapshots.get(conversationId) ?? null
  }

  async appendTurn(conversationId, turn, scope = 'customer_public') {
    const current =
      (await this.get(conversationId)) ?? {
        conversationId,
        scope,
        turns: [],
        summary: null,
        compiledContext: null,
        updatedAt: new Date().toISOString(),
      }

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
