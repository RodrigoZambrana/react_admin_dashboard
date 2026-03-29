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

export class BackendConversationsClient {
  constructor(config) {
    this.baseUrl = config.backendBaseUrl.replace(/\/$/, '')
    this.internalToken = config.internalToken
  }

  async createWebchatMessage(payload) {
    const response = await fetch(`${this.baseUrl}/conversations/webchat/message`, {
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
    const response = await fetch(
      `${this.baseUrl}/conversations/${conversationId}/agent-reply`,
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
      throw new Error(`replyAsAgent ${response.status}: ${JSON.stringify(await toJson(response))}`)
    }

    return response.json()
  }

  async ingestInboundMessage(payload) {
    const response = await fetch(`${this.baseUrl}/conversations/internal/inbound`, {
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
      `${this.baseUrl}/conversations/internal/history-message`,
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
      `${this.baseUrl}/conversations/internal/bootstrap-thread`,
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
      `${this.baseUrl}/conversations/internal/outbound-status`,
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
