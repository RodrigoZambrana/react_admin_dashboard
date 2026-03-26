import Redis from 'ioredis'

const buildKey = (conversationId) => `ai:conversation:${conversationId}`

export class RedisConversationStore {
  constructor(redisUrl) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
    this.connected = false
    this.connectPromise = null
  }

  async ensureConnected() {
    if (this.connected || this.redis.status === 'ready') {
      this.connected = true
      return
    }

    if (this.connectPromise) {
      await this.connectPromise
      return
    }

    if (this.redis.status === 'connecting' || this.redis.status === 'connect') {
      this.connectPromise = new Promise((resolve, reject) => {
        const cleanup = () => {
          this.redis.off('ready', onReady)
          this.redis.off('error', onError)
          this.connectPromise = null
        }

        const onReady = () => {
          cleanup()
          this.connected = true
          resolve()
        }

        const onError = (error) => {
          cleanup()
          reject(error)
        }

        this.redis.once('ready', onReady)
        this.redis.once('error', onError)
      })

      await this.connectPromise
      return
    }

    this.connectPromise = this.redis
      .connect()
      .then(() => {
        this.connected = true
      })
      .finally(() => {
        this.connectPromise = null
      })

    await this.connectPromise
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
