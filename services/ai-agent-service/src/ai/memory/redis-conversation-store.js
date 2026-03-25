import Redis from 'ioredis'

const buildKey = (conversationId) => `ai:conversation:${conversationId}`

export class RedisConversationStore {
  constructor(redisUrl) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
    this.connected = false
  }

  async ensureConnected() {
    if (!this.connected) {
      await this.redis.connect()
      this.connected = true
    }
  }

  async get(conversationId) {
    await this.ensureConnected()
    const raw = await this.redis.get(buildKey(conversationId))
    return raw ? JSON.parse(raw) : null
  }

  async appendTurn(conversationId, turn, scope = 'customer_public') {
    const snapshot =
      (await this.get(conversationId)) ?? {
        conversationId,
        scope,
        turns: [],
        summary: null,
        compiledContext: null,
        updatedAt: new Date().toISOString(),
      }

    snapshot.turns.push(turn)
    snapshot.updatedAt = new Date().toISOString()
    await this.replace(conversationId, snapshot)
  }

  async replace(conversationId, snapshot) {
    await this.ensureConnected()
    await this.redis.set(buildKey(conversationId), JSON.stringify(snapshot))
  }

  async clear(conversationId) {
    await this.ensureConnected()
    await this.redis.del(buildKey(conversationId))
  }
}
