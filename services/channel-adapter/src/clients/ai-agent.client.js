export class AiAgentClient {
  constructor(config) {
    this.baseUrl = config.aiAgentBaseUrl.replace(/\/$/, '')
  }

  async respond(message) {
    const response = await fetch(`${this.baseUrl}/respond`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`ai.respond ${response.status}`)
    }

    return response.json()
  }
}
