const toJson = async (response) => {
  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const AI_PLATFORM_UNSAFE_PATTERNS = [
  /('|\")\s*or\s+(\d+|true|false|null)/gi,
  /\bUNION\b\s+\bSELECT\b/gi,
  /\bDROP\b\s+\bTABLE\b/gi,
  /\bTRUNCATE\b\s+\bTABLE\b/gi,
  /\bALTER\b\s+\bTABLE\b/gi,
  /\bEXEC(UTE)?\b/gi,
  /\bINSERT\b\s+\bINTO\b/gi,
  /\bDELETE\b\s+\bFROM\b/gi,
  /\bUPDATE\b\s+\bSET\b/gi,
  /--/g,
  /\/\*/g,
  /\*\//g,
  /<[^>]+>/g,
]

const sanitizeAiPlatformString = (value) => {
  if (typeof value !== 'string') {
    return value
  }

  let sanitized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim()

  for (const pattern of AI_PLATFORM_UNSAFE_PATTERNS) {
    sanitized = sanitized.replace(pattern, ' ')
  }

  return sanitized.replace(/\s+/g, ' ').trim()
}

const sanitizeAiPlatformPayload = (value) => {
  if (typeof value === 'string') {
    return sanitizeAiPlatformString(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAiPlatformPayload(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeAiPlatformPayload(entry)]),
    )
  }

  return value
}

export class AiPlatformConversationsClient {
  constructor(config) {
    this.baseUrl = config.aiPlatformBaseUrl.replace(/\/$/, '')
    this.internalToken = config.internalToken
  }

  async createWebchatMessage(payload) {
    const response = await fetch(`${this.baseUrl}/chat/public/webchat/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`createWebchatMessage ${response.status}: ${JSON.stringify(await toJson(response))}`)
    }

    return response.json()
  }

  async replyAsAgent(conversationId, payload) {
    const sanitizedPayload = sanitizeAiPlatformPayload(payload)
    const response = await fetch(
      `${this.baseUrl}/internal/conversations/${conversationId}/replies/agent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-internal-token': this.internalToken,
        },
        body: JSON.stringify(sanitizedPayload),
      },
    )

    if (!response.ok) {
      throw new Error(`replyAsAgent ${response.status}: ${JSON.stringify(await toJson(response))}`)
    }

    return response.json()
  }

  async ingestInboundMessage(payload) {
    const response = await fetch(`${this.baseUrl}/internal/conversations/inbound`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ai-internal-token': this.internalToken,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(
        `ingestInboundMessage ${response.status}: ${JSON.stringify(await toJson(response))}`,
      )
    }

    return response.json()
  }

  async importChannelHistoryMessage(payload) {
    const response = await fetch(
      `${this.baseUrl}/internal/conversations/history-message`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-internal-token': this.internalToken,
        },
        body: JSON.stringify(payload),
      },
    )

    if (!response.ok) {
      throw new Error(
        `importChannelHistoryMessage ${response.status}: ${JSON.stringify(await toJson(response))}`,
      )
    }

    return response.json()
  }

  async bootstrapChannelThread(payload) {
    const response = await fetch(
      `${this.baseUrl}/internal/conversations/bootstrap-thread`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-internal-token': this.internalToken,
        },
        body: JSON.stringify(payload),
      },
    )

    if (!response.ok) {
      throw new Error(
        `bootstrapChannelThread ${response.status}: ${JSON.stringify(await toJson(response))}`,
      )
    }

    return response.json()
  }

  async syncOutboundStatus(payload) {
    const response = await fetch(
      `${this.baseUrl}/internal/conversations/outbound-status`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-internal-token': this.internalToken,
        },
        body: JSON.stringify(payload),
      },
    )

    if (!response.ok) {
      throw new Error(
        `syncOutboundStatus ${response.status}: ${JSON.stringify(await toJson(response))}`,
      )
    }

    return response.json()
  }
}
