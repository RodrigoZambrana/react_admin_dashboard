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
    const url = new URL(`${this.baseUrl}/ai/products`)
    url.searchParams.set('search', search)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(limit))

    const response = await fetch(url, {
      headers: {
        'x-ai-internal-token': this.internalToken,
      },
    })
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.products ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    const payload = await response.json()
    return (payload?.items ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      productCode: product.productCode ?? null,
      currency: product.currency ?? null,
      amount: product.salePrice ?? null,
      shortDescription: product.description ?? null,
      mode: product.mode ?? null,
    }))
  }

  async createCustomer(payload) {
    return this.post('/ai/customers', payload)
  }

  async createAppointment(payload) {
    return this.post('/ai/appointments', payload)
  }

  async createProduct(payload) {
    return this.post('/ai/products', payload)
  }

  async createOrder(payload) {
    return this.post('/ai/orders', payload)
  }

  async createQuote(payload) {
    return this.post('/ai/quotes', payload)
  }

  async createPayment(payload) {
    return this.post('/ai/payments', payload)
  }

  async post(path, payload) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ai-internal-token': this.internalToken,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend${path} ${response.status}: ${JSON.stringify(body)}`)
    }

    return response.json()
  }
}
