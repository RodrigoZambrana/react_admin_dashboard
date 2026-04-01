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

const ACTION_KEY_ALIASES = Object.freeze({
  'aberturas.register': 'catalog.register_structured_items',
  'aberturas.prepare_quote': 'catalog.prepare_structured_quote',
  'aberturas.parse': 'catalog.parse_structured_items',
})

const TOOL_NAME_ALIASES = Object.freeze({
  prepare_aberturas_insert: 'prepare_structured_catalog_insert',
  prepare_aberturas_quote: 'prepare_structured_catalog_quote',
  parse_aberturas: 'parse_structured_catalog_items',
})

const normalizeActionKey = (value) =>
  ACTION_KEY_ALIASES[String(value || '').trim()] || String(value || '').trim() || null

const normalizeToolName = (value) =>
  TOOL_NAME_ALIASES[String(value || '').trim()] || String(value || '').trim() || null

const normalizeActionCatalogEntry = (entry = null) => {
  if (!entry || typeof entry !== 'object') {
    return entry
  }

  return {
    ...entry,
    key: normalizeActionKey(entry.key),
    toolName: normalizeToolName(entry.toolName),
    allowedTools: Array.isArray(entry.allowedTools)
      ? entry.allowedTools.map((toolName) => normalizeToolName(toolName))
      : entry.allowedTools,
    forbiddenIntents: Array.isArray(entry.forbiddenIntents)
      ? entry.forbiddenIntents.map((intentKey) => normalizeActionKey(intentKey))
      : entry.forbiddenIntents,
    requiresConfirmation: Array.isArray(entry.requiresConfirmation)
      ? entry.requiresConfirmation.map((toolName) => normalizeToolName(toolName))
      : entry.requiresConfirmation,
  }
}

export class BackendAiClient {
  constructor(config) {
    this.baseUrl = config.backendBaseUrl.replace(/\/$/, '')
    this.internalToken = config.aiInternalToken || 'local-ai-internal-token'
    this.runtimeRole = null
  }

  scoped(role) {
    const scopedClient = Object.create(this)
    scopedClient.runtimeRole = role
    return scopedClient
  }

  buildHeaders(extra = {}) {
    return {
      ...extra,
      'x-ai-internal-token': this.internalToken,
      ...(this.runtimeRole ? { 'x-ai-role': this.runtimeRole } : {}),
    }
  }

  async getRuntimeConfig() {
    const response = await fetch(`${this.baseUrl}/ai/runtime-config/internal`, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.ai.runtime_config ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    const payload = await response.json()
    return Array.isArray(payload)
      ? payload.map(normalizeActionCatalogEntry)
      : Array.isArray(payload?.items)
        ? { ...payload, items: payload.items.map(normalizeActionCatalogEntry) }
        : payload
  }

  async getActions() {
    const response = await fetch(`${this.baseUrl}/ai/actions`, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend.ai.actions ${response.status}: ${JSON.stringify(body)}`)
    }

    return response.json()
  }

  async searchKnowledge(query, scope = 'customer_public', limit = 5, tenantKey) {
    const url = new URL(`${this.baseUrl}/ai/knowledge/retrieve`)
    url.searchParams.set('query', query)
    url.searchParams.set('scope', scope)
    url.searchParams.set('limit', String(limit))
    if (tenantKey) {
      url.searchParams.set('tenantKey', tenantKey)
    }

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.ai.knowledge.retrieve ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    return response.json()
  }

  async getTopicTaxonomy(tenantKey, scope = 'customer_public') {
    const url = new URL(`${this.baseUrl}/ai/knowledge/topic-taxonomy`)
    if (tenantKey) {
      url.searchParams.set('tenantKey', tenantKey)
    }
    if (scope) {
      url.searchParams.set('scope', scope)
    }

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.ai.knowledge.topic_taxonomy ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    return response.json()
  }

  async getQuoteProfiles(tenantKey, scope = 'customer_public') {
    const url = new URL(`${this.baseUrl}/ai/knowledge/quote-profiles`)
    if (tenantKey) {
      url.searchParams.set('tenantKey', tenantKey)
    }
    if (scope) {
      url.searchParams.set('scope', scope)
    }

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.ai.knowledge.quote_profiles ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    return response.json()
  }

  async lookupOwnedCustomerDocument(customerId, identifier, documentType = 'ORDER') {
    const url = new URL(`${this.baseUrl}/ai/customer-documents/lookup`)
    url.searchParams.set('customerId', String(customerId))
    url.searchParams.set('identifier', String(identifier || '').trim())
    url.searchParams.set('documentType', String(documentType || 'ORDER').trim())

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.ai.customer_documents.lookup ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    return response.json()
  }

  async getUsageSnapshot() {
    const response = await fetch(`${this.baseUrl}/usage/internal`, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend.usage ${response.status}: ${JSON.stringify(body)}`)
    }

    return response.json()
  }

  async searchProducts(search, limit = 5) {
    const url = new URL(`${this.baseUrl}/ai/products`)
    url.searchParams.set('search', search)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(limit))

    const response = await fetch(url, {
      headers: this.buildHeaders(),
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
      productType: product.productType ?? null,
      unitOfMeasure: product.unitOfMeasure ?? null,
      category: product.category ?? null,
    }))
  }

  async searchCategories(search, limit = 5) {
    const url = new URL(`${this.baseUrl}/ai/categories`)
    url.searchParams.set('search', search)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(limit))

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend.categories ${response.status}: ${JSON.stringify(body)}`)
    }

    const payload = await response.json()
    return payload?.items ?? []
  }

  async searchCustomers(search, limit = 5) {
    const url = new URL(`${this.baseUrl}/ai/customers`)
    url.searchParams.set('search', search)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(limit))

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend.customers ${response.status}: ${JSON.stringify(body)}`)
    }

    const payload = await response.json()
    return payload?.items ?? []
  }

  async searchAppointments(searchOrOptions, limit = 5) {
    const url = new URL(`${this.baseUrl}/ai/appointments`)
    if (typeof searchOrOptions === 'string') {
      url.searchParams.set('search', searchOrOptions)
      url.searchParams.set('pageSize', String(limit))
    } else {
      const options =
        searchOrOptions && typeof searchOrOptions === 'object' ? searchOrOptions : {}
      if (typeof options.search === 'string' && options.search.trim()) {
        url.searchParams.set('search', options.search.trim())
      }
      if (typeof options.dateFrom === 'string' && options.dateFrom.trim()) {
        url.searchParams.set('dateFrom', options.dateFrom.trim())
      }
      if (typeof options.dateTo === 'string' && options.dateTo.trim()) {
        url.searchParams.set('dateTo', options.dateTo.trim())
      }
      url.searchParams.set(
        'pageSize',
        String(
          Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
            ? Number(options.limit)
            : limit,
        ),
      )
    }
    url.searchParams.set('page', '1')

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend.appointments ${response.status}: ${JSON.stringify(body)}`)
    }

    const payload = await response.json()
    return payload?.items ?? []
  }

  async searchCustomerAppointments(searchOrOptions, limit = 5) {
    const url = new URL(`${this.baseUrl}/ai/customer-appointments`)
    if (typeof searchOrOptions === 'string') {
      url.searchParams.set('search', searchOrOptions)
      url.searchParams.set('pageSize', String(limit))
    } else {
      const options =
        searchOrOptions && typeof searchOrOptions === 'object' ? searchOrOptions : {}
      if (typeof options.search === 'string' && options.search.trim()) {
        url.searchParams.set('search', options.search.trim())
      }
      if (typeof options.dateFrom === 'string' && options.dateFrom.trim()) {
        url.searchParams.set('dateFrom', options.dateFrom.trim())
      }
      if (typeof options.dateTo === 'string' && options.dateTo.trim()) {
        url.searchParams.set('dateTo', options.dateTo.trim())
      }
      url.searchParams.set(
        'pageSize',
        String(
          Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
            ? Number(options.limit)
            : limit,
        ),
      )
    }
    url.searchParams.set('page', '1')

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(
        `backend.customer_appointments ${response.status}: ${JSON.stringify(body)}`,
      )
    }

    const payload = await response.json()
    return payload?.items ?? []
  }

  async searchOrders(search, limit = 5, documentType = 'ORDER') {
    const url = new URL(`${this.baseUrl}/ai/orders`)
    url.searchParams.set('search', search)
    url.searchParams.set('documentType', documentType)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(limit))

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend.orders ${response.status}: ${JSON.stringify(body)}`)
    }

    const payload = await response.json()
    return payload?.items ?? []
  }

  async searchPayments(search, limit = 5) {
    const url = new URL(`${this.baseUrl}/ai/payments`)
    url.searchParams.set('search', search)
    url.searchParams.set('page', '1')
    url.searchParams.set('pageSize', String(limit))

    const response = await fetch(url, {
      headers: this.buildHeaders(),
    })
    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend.payments ${response.status}: ${JSON.stringify(body)}`)
    }

    const payload = await response.json()
    return payload?.items ?? []
  }

  async createCustomer(payload) {
    return this.post('/ai/customers', payload)
  }

  async updateCustomer(id, payload) {
    return this.put(`/ai/customers/${id}`, payload)
  }

  async createAppointment(payload) {
    return this.post('/ai/appointments', payload)
  }

  async createCustomerAppointment(payload) {
    return this.post('/ai/customer-appointments', payload)
  }

  async updateAppointment(id, payload) {
    return this.put(`/ai/appointments/${id}`, payload)
  }

  async deleteAppointment(id) {
    return this.delete(`/ai/appointments/${id}`)
  }

  async createProduct(payload) {
    return this.post('/ai/products', payload)
  }

  async previewProductQuote(payload) {
    return this.post('/ai/products/quote-preview', payload)
  }

  async createCategory(payload) {
    return this.post('/ai/categories', payload)
  }

  async updateCategory(id, payload) {
    return this.put(`/ai/categories/${id}`, payload)
  }

  async updateProduct(id, payload) {
    return this.put(`/ai/products/${id}`, payload)
  }

  async adjustProductStock(id, payload) {
    return this.post(`/ai/products/${id}/adjust-stock`, payload)
  }

  async archiveProduct(id) {
    return this.post(`/ai/products/${id}/archive`, {})
  }

  async publishProduct(id) {
    return this.post(`/ai/products/${id}/publish`, {})
  }

  async createOrder(payload) {
    return this.post('/ai/orders', payload)
  }

  async updateOrderStatus(id, payload) {
    return this.put(`/ai/orders/${id}/status`, payload)
  }

  async updateOrderComment(id, payload) {
    return this.put(`/ai/orders/${id}/comment`, payload)
  }

  async updateOrderStructure(id, payload) {
    return this.put(`/ai/orders/${id}`, payload)
  }

  async createQuote(payload) {
    return this.post('/ai/quotes', payload)
  }

  async sendQuote(id) {
    return this.post(`/ai/quotes/${id}/send`, {})
  }

  async confirmQuote(id) {
    return this.post(`/ai/quotes/${id}/confirm`, {})
  }

  async updateQuoteStatus(id, payload) {
    return this.put(`/ai/quotes/${id}/status`, payload)
  }

  async updateQuoteComment(id, payload) {
    return this.put(`/ai/quotes/${id}/comment`, payload)
  }

  async updateQuoteStructure(id, payload) {
    return this.put(`/ai/quotes/${id}`, payload)
  }

  async createPayment(payload) {
    return this.post('/ai/payments', payload)
  }

  async updatePaymentStatus(id, payload) {
    return this.put(`/ai/payments/${id}/status`, payload)
  }

  async updatePayment(id, payload) {
    return this.put(`/ai/payments/${id}`, payload)
  }

  async parseAberturas(payload) {
    return this.post('/ai/aberturas/parse', payload)
  }

  async parseStructuredCatalogItems(payload) {
    return this.parseAberturas(payload)
  }

  async prepareAberturasInsert(payload) {
    return this.post('/ai/aberturas/prepare-insert', payload)
  }

  async prepareStructuredCatalogInsert(payload) {
    return this.prepareAberturasInsert(payload)
  }

  async prepareAberturasQuote(payload) {
    return this.post('/ai/aberturas/prepare-quote', payload)
  }

  async prepareStructuredCatalogQuote(payload) {
    return this.prepareAberturasQuote(payload)
  }

  async extractAssets(payload) {
    return this.post('/ai/assets/extract', payload)
  }

  async post(path, payload) {
    return this.request('POST', path, payload)
  }

  async put(path, payload) {
    return this.request('PUT', path, payload)
  }

  async delete(path) {
    return this.request('DELETE', path)
  }

  async request(method, path, payload) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.buildHeaders({
        'content-type': 'application/json',
      }),
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    })

    if (!response.ok) {
      const body = await toJson(response)
      throw new Error(`backend${path} ${response.status}: ${JSON.stringify(body)}`)
    }

    return response.json()
  }
}
