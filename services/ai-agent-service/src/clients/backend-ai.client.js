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

export class BackendAiClient {
  constructor(config) {
    this.baseUrl = config.backendBaseUrl.replace(/\/$/, '')
    this.internalToken = config.aiInternalToken || 'local-ai-internal-token'
  }

  async getRuntimeConfig() {
    const response = await fetch(`${this.baseUrl}/ai/runtime-config/internal`, {
      headers: {
        'x-ai-internal-token': this.internalToken,
      },
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.ai.runtime_config ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    return response.json()
  }

  async searchProducts(search, limit = 5) {
    const url = new URL(`${this.baseUrl}/storefront/products`)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(limit))
    url.searchParams.set('search', search)

    const response = await fetch(url)
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.products ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    const payload = await response.json()
    return (payload?.data ?? []).map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      currency: product.price?.currency ?? null,
      amount: product.price?.amount ?? null,
      shortDescription: product.shortDescription ?? null,
      mode: product.mode ?? null,
    }))
  }
}
