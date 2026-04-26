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

const resolveLocale = (payload) =>
  payload?.locale ||
  payload?.metadata?.locale ||
  payload?.preferences?.locale ||
  undefined

export class AiPlatformAgentClient {
  constructor(config) {
    this.baseUrl = config.aiPlatformBaseUrl.replace(/\/$/, '')
    this.internalToken = config.internalToken
  }

  async respond(payload) {
    const message = String(payload?.text || payload?.message || '').trim()
    const conversationId = String(payload?.conversationId || '').trim()

    if (!conversationId) {
      const response = await fetch(`${this.baseUrl}/chat/message`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message,
          locale: resolveLocale(payload),
          channel: payload?.channel,
        }),
      })

      if (!response.ok) {
        throw new Error(`aiPlatform.respond ${response.status}: ${JSON.stringify(await toJson(response))}`)
      }

      return response.json()
    }

    const response = await fetch(
      `${this.baseUrl}/internal/conversations/${conversationId}/agent-turn`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-internal-token': this.internalToken,
        },
        body: JSON.stringify({
          message,
          locale: resolveLocale(payload),
          channel: payload?.channel,
          metadata: payload?.metadata || {},
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`aiPlatform.agentTurn ${response.status}: ${JSON.stringify(await toJson(response))}`)
    }

    return response.json()
  }
}
