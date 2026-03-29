const META_GRAPH_BASE_URL = 'https://graph.facebook.com'
const META_GRAPH_VERSION = 'v23.0'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const parseJsonSafe = (raw) => {
  if (!raw) {
    return {}
  }
  try {
    return JSON.parse(raw)
  } catch {
    return { raw }
  }
}

const cleanString = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const isRetryableStatus = (status) => status === 429 || status >= 500

export class MetaSender {
  constructor(config, options = {}) {
    this.config = config
    this.fetchImpl = options.fetchImpl || fetch
    this.graphVersion = cleanString(config.metaGraphVersion) || META_GRAPH_VERSION
    this.graphBaseUrl = cleanString(config.metaGraphBaseUrl) || META_GRAPH_BASE_URL
    this.maxRetries = Number.isFinite(Number(config.metaSenderMaxRetries))
      ? Number(config.metaSenderMaxRetries)
      : 2
  }

  async sendMessage(payload) {
    const platform = this.normalizePlatform(payload?.platform || payload?.channel)
    const recipientId = cleanString(payload?.recipientId)

    if (!recipientId) {
      throw new Error('recipientId is required for Meta outbound messages')
    }

    const accessToken = this.resolveAccessToken(platform)
    if (!accessToken) {
      throw new Error(`Missing Meta access token for ${platform}`)
    }

    const endpoint = this.resolveEndpoint(platform)
    const message = this.buildMessagePayload(payload)
    const requestBody = {
      recipient: { id: recipientId },
      messaging_type: payload?.messagingType || 'RESPONSE',
      message,
    }

    const response = await this.sendWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      {
        platform,
        recipientId,
      },
    )

    const remoteId = cleanString(response?.message_id) || `meta:${Date.now()}`

    return {
      provider: 'meta-graph',
      remoteId,
      providerMessageId: remoteId,
      threadRemoteId: cleanString(payload?.threadId) || recipientId,
      deliveryStatus: 'accepted',
      metadata: {
        platform,
        recipientId,
        requestBody,
        response,
      },
    }
  }

  normalizePlatform(value) {
    const normalized = cleanString(value)?.toLowerCase()
    if (normalized === 'messenger') {
      return 'facebook'
    }
    if (normalized === 'instagram') {
      return 'instagram'
    }
    return 'facebook'
  }

  resolveAccessToken(platform) {
    if (platform === 'instagram') {
      return (
        cleanString(this.config.instagramAccessToken) ||
        cleanString(this.config.metaPageAccessToken) ||
        cleanString(this.config.messengerPageAccessToken)
      )
    }

    return (
      cleanString(this.config.messengerPageAccessToken) ||
      cleanString(this.config.metaPageAccessToken)
    )
  }

  resolveEndpoint(platform) {
    if (platform === 'instagram' && cleanString(this.config.instagramBusinessAccountId)) {
      return `${this.graphBaseUrl}/${this.graphVersion}/${this.config.instagramBusinessAccountId}/messages`
    }

    return `${this.graphBaseUrl}/${this.graphVersion}/me/messages`
  }

  buildMessagePayload(payload) {
    const attachment = payload?.attachment
    if (attachment && typeof attachment === 'object') {
      return {
        attachment,
      }
    }

    const text = cleanString(payload?.text)
    const quickReplies = Array.isArray(payload?.quickReplies) ? payload.quickReplies : []
    if (!text) {
      throw new Error('text is required for Meta outbound messages without attachment')
    }

    if (quickReplies.length > 0) {
      return {
        text,
        quick_replies: quickReplies
          .map((item) => {
            if (!item || typeof item !== 'object') {
              return null
            }

            const title = cleanString(item.title)
            const quickReplyPayload = cleanString(item.payload)
            const contentType = cleanString(item.contentType) || 'text'

            if (!title || !quickReplyPayload) {
              return null
            }

            return {
              content_type: contentType,
              title,
              payload: quickReplyPayload,
              image_url: cleanString(item.imageUrl) || undefined,
            }
          })
          .filter(Boolean),
      }
    }

    return {
      text,
    }
  }

  async sendWithRetry(url, init, context) {
    let lastError = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchImpl(url, init)
      const raw = await response.text()
      const parsed = parseJsonSafe(raw)

      if (response.ok) {
        return parsed
      }

      const error = new Error(
        parsed?.error?.message ||
          `Meta Send API failed with status ${response.status}`,
      )
      error.meta = {
        status: response.status,
        code: parsed?.error?.code || null,
        type: parsed?.error?.type || null,
        platform: context.platform,
        recipientId: context.recipientId,
      }
      lastError = error

      if (!isRetryableStatus(response.status) || attempt === this.maxRetries) {
        throw error
      }

      await sleep(500 * (attempt + 1))
    }

    throw lastError || new Error('Meta Send API failed')
  }
}
