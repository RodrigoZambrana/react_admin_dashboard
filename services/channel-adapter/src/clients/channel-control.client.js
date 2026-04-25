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

export class ChannelControlClient {
  constructor(config) {
    this.baseUrl = config.aiPlatformBaseUrl.replace(/\/$/, '')
    this.internalToken = config.internalToken
  }

  async getChannelSnapshot(channelKey) {
    const response = await fetch(
      `${this.baseUrl}/internal/channel-control/channels/${encodeURIComponent(channelKey)}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-ai-internal-token': this.internalToken,
        },
      },
    )

    if (!response.ok) {
      throw new Error(
        `getChannelSnapshot ${response.status}: ${JSON.stringify(await toJson(response))}`,
      )
    }

    return response.json()
  }

  async syncConnectionState(channelKey, payload) {
    const response = await fetch(
      `${this.baseUrl}/internal/channel-control/channels/${encodeURIComponent(channelKey)}/connection-state`,
      {
        method: 'PUT',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-ai-internal-token': this.internalToken,
        },
        body: JSON.stringify(payload),
      },
    )

    if (!response.ok) {
      throw new Error(
        `syncConnectionState ${response.status}: ${JSON.stringify(await toJson(response))}`,
      )
    }

    return response.json()
  }
}
