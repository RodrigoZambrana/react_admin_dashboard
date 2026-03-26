import { buildSystemPrompt } from './prompt/system-prompt.js'
import { createModelProvider } from './model/provider-factory.js'
import { getToolsForScope } from './tools/action-tools.js'

const summarizeResults = (toolName, results = []) => {
  if (toolName === 'parse_aberturas') {
    return results?.summary
      ? `parse_aberturas: ${results.summary}`
      : 'parse_aberturas: sin items detectados.'
  }

  if (toolName === 'prepare_aberturas_quote') {
    return results?.summary
      ? `prepare_aberturas_quote: ${results.summary}`
      : 'prepare_aberturas_quote: sin items listos para cotización.'
  }

  if (toolName === 'prepare_aberturas_insert') {
    return results?.summary
      ? `prepare_aberturas_insert: ${results.summary}`
      : 'prepare_aberturas_insert: sin items listos para alta.'
  }

  if (!Array.isArray(results) || !results.length) {
    return `${toolName}: sin resultados.`
  }

  const preview = results
    .slice(0, 3)
    .map((item) => {
      switch (toolName) {
        case 'search_categories':
          return `categoria#${item.id} ${item.name}${item.parent?.name ? ` padre:${item.parent.name}` : ''}`
        case 'search_customers':
          return `cliente#${item.id} ${item.name}${item.email ? ` <${item.email}>` : ''}${item.phoneNumber ? ` tel:${item.phoneNumber}` : ''}`
        case 'search_orders':
        case 'search_quotes':
          return `${toolName === 'search_quotes' ? 'presupuesto' : 'pedido'}#${item.id} uuid:${item.uuid} cliente:${item.customer?.name ?? 'sin cliente'}${item.currency ? ` ${item.currency}` : ''}${item.grandTotal != null ? ` total:${item.grandTotal}` : ''}`
        case 'search_payments':
          return `pago#${item.id}${item.reference ? ` ref:${item.reference}` : ''}${item.currency ? ` ${item.currency}` : ''}${item.amount != null ? ` monto:${item.amount}` : ''}${item.order?.uuid ? ` pedido:${item.order.uuid}` : ''}`
        case 'search_products':
          return `producto#${item.id} ${item.name}${item.productCode ? ` código:${item.productCode}` : ''}${item.currency && item.amount != null ? ` ${item.currency} ${item.amount}` : ''}`
        default:
          return JSON.stringify(item)
      }
    })
    .join(' | ')

  return `${toolName}: ${preview}`
}

const summarizeMatchesForUser = (toolName, results = []) => {
  if (toolName === 'parse_aberturas') {
    return typeof results?.summary === 'string'
      ? `parseo de aberturas: ${results.summary}`
      : null
  }

  if (toolName === 'prepare_aberturas_quote') {
    return typeof results?.summary === 'string'
      ? `borrador de aberturas: ${results.summary}`
      : null
  }

  if (toolName === 'prepare_aberturas_insert') {
    return typeof results?.summary === 'string'
      ? `alta de aberturas: ${results.summary}`
      : null
  }

  if (!Array.isArray(results) || !results.length) {
    return null
  }

  const preview = results
    .slice(0, 2)
    .map((item) => {
      switch (toolName) {
        case 'search_categories':
          return `categoría #${item.id} ${item.name}${item.parent?.name ? ` (padre: ${item.parent.name})` : ''}`
        case 'search_customers':
          return `cliente #${item.id} ${item.name}${item.email ? ` <${item.email}>` : ''}`
        case 'search_orders':
          return `pedido #${item.id}${item.uuid ? ` (${item.uuid})` : ''}${item.customer?.name ? ` de ${item.customer.name}` : ''}`
        case 'search_quotes':
          return `presupuesto #${item.id}${item.uuid ? ` (${item.uuid})` : ''}${item.customer?.name ? ` de ${item.customer.name}` : ''}`
        case 'search_payments':
          return `pago #${item.id}${item.reference ? ` (${item.reference})` : ''}${item.order?.uuid ? ` pedido ${item.order.uuid}` : ''}`
        case 'search_products':
          return `producto #${item.id} ${item.name}${item.currency && item.amount != null ? ` ${item.currency} ${item.amount}` : ''}`
        default:
          return null
      }
    })
    .filter(Boolean)
    .join(', ')

  return preview || null
}

const findActionIntent = (input, actionCatalog = []) => {
  let bestMatch = null
  let bestScore = -1

  for (const entry of actionCatalog) {
    if (!Array.isArray(entry.keywords)) {
      continue
    }
    for (const token of entry.keywords) {
      const normalized = String(token).toLowerCase()
      if (!normalized || !input.includes(normalized)) {
        continue
      }
      if (normalized.length > bestScore) {
        bestMatch = entry
        bestScore = normalized.length
      }
    }
  }

  return bestMatch
}

const extractNamedEntity = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const value = match?.[1]?.trim()
    if (value) {
      return value.replace(/[.,;:]$/g, '').trim()
    }
  }
  return null
}

const normalizeEntityQuery = (value) =>
  value
    ?.replace(/^(?:el|la)\s+/iu, '')
    ?.replace(/^(?:pedido|presupuesto|cliente|producto)\s+de\s+/iu, '')
    ?.replace(/^(?:pedido|presupuesto|cliente|producto)\s+/iu, '')
    ?.trim() || null

export class AiAgentRuntime {
  constructor({ config, provider, memoryStore, backendClient }) {
    this.config = config
    this.activeConfig = config
    this.provider = provider
    this.memoryStore = memoryStore
    this.backendClient = backendClient
    this.runtimeConfigLoadedAt = 0
    this.actionCatalog = []
    this.actionCatalogLoadedAt = 0
  }

  async refreshRuntimeConfig() {
    const now = Date.now()
    if (now - this.runtimeConfigLoadedAt < 30_000) {
      return this.activeConfig
    }

    try {
      const runtimeConfig = await this.backendClient.getRuntimeConfig()
      const nextConfig = {
        ...this.config,
        modelProvider: runtimeConfig.provider || this.config.modelProvider,
        modelName: runtimeConfig.model || this.config.modelName,
        openAiApiKey:
          runtimeConfig.openAiApiKey !== undefined
            ? runtimeConfig.openAiApiKey
            : this.config.openAiApiKey,
        enabled:
          runtimeConfig.enabled !== undefined
            ? runtimeConfig.enabled
            : true,
        monthlySpendingLimitUsd: runtimeConfig.monthlySpendingLimitUsd,
        currentUsageUsd: runtimeConfig.currentUsageUsd,
        warningThresholdPercent: runtimeConfig.warningThresholdPercent,
        usageMessage: runtimeConfig.usageMessage,
        adminInternalPrompt: runtimeConfig.adminInternalPrompt,
        customerPublicPrompt: runtimeConfig.customerPublicPrompt,
        updatedAt: runtimeConfig.updatedAt || null,
      }

      const currentSignature = this.buildProviderSignature(this.activeConfig)
      const nextSignature = this.buildProviderSignature(nextConfig)
      if (currentSignature !== nextSignature) {
        this.provider = createModelProvider(nextConfig)
      }
      this.activeConfig = nextConfig
    } catch (error) {
      console.warn('[ai-agent-service] Unable to refresh runtime config', error)
      this.activeConfig = {
        ...this.config,
        enabled: true,
      }
    }

    this.runtimeConfigLoadedAt = now
    return this.activeConfig
  }

  async invalidateCaches({ refreshRuntime = false } = {}) {
    this.runtimeConfigLoadedAt = 0
    this.actionCatalogLoadedAt = 0
    this.actionCatalog = []

    if (refreshRuntime) {
      await this.refreshRuntimeConfig()
    }
  }

  async respond(unifiedMessage) {
    const runtimeConfig = await this.refreshRuntimeConfig()
    if (runtimeConfig.enabled === false) {
      return {
        conversationId: unifiedMessage.conversationId || unifiedMessage.userId,
        scope: unifiedMessage.scope || 'customer_public',
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text:
          runtimeConfig.usageMessage ||
          'El asistente está temporalmente deshabilitado. Un operador puede continuar la atención.',
        toolCalls: [],
      }
    }

    const conversationId = unifiedMessage.conversationId || unifiedMessage.userId
    const scope = unifiedMessage.scope || 'customer_public'
    const snapshot = await this.memoryStore.get(conversationId)
    const history = snapshot?.turns ?? []
    const actionCatalog = await this.getActionCatalog(scope)
    const actionIntent = findActionIntent(
      String(unifiedMessage.text || '').toLowerCase(),
      actionCatalog,
    )
    const tools = this.filterToolsForIntent(
      getToolsForScope(scope, this.backendClient),
      actionIntent,
    )
    const retrievalContext = await this.getRetrievalContext(unifiedMessage, scope)
    const operationalContext = await this.getOperationalContext(
      unifiedMessage,
      scope,
      actionCatalog,
    )

    let generatedResponse
    try {
      generatedResponse = await this.provider.generate({
        scope,
        systemPrompt: buildSystemPrompt(scope, {
          actionCatalog,
          retrievalContext: retrievalContext.items,
          operationalContext: operationalContext.items,
          hasApprovedContext: retrievalContext.items.length > 0,
          customInstructions:
            scope === 'admin_internal'
              ? runtimeConfig.adminInternalPrompt
              : runtimeConfig.customerPublicPrompt,
        }),
        history,
        input: unifiedMessage.text,
        tools,
        actionCatalog,
        retrievalContext: retrievalContext.items,
      })
    } catch (error) {
      const normalizedMessage =
        error instanceof Error ? error.message.toLowerCase() : 'provider error'
      const fallbackReason = normalizedMessage.includes('429') ||
        normalizedMessage.includes('quota') ||
        normalizedMessage.includes('rate limit')
        ? 'provider_quota_exceeded'
        : 'provider_error'

      generatedResponse = {
        text:
          scope === 'admin_internal'
            ? 'En este momento no pude completar la asistencia automática. Puedes continuar por la vía operativa habitual y, si hace falta, tomar control de la conversación para que un responsable la siga.'
            : 'En este momento no pude completar la respuesta automática. Un asesor del equipo te indicará cómo continuar y te ayudará con el siguiente paso.',
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
          fallbackReason,
        },
      }
    }

    const response = this.applyGroundingFallback(
      unifiedMessage.text,
      scope,
      retrievalContext,
      {
        ...generatedResponse,
        toolCalls: [
          ...(operationalContext.toolCalls ?? []),
          ...(generatedResponse.toolCalls ?? []),
        ],
      },
    )
    const annotatedResponse = this.annotateOperationalMatches(response, operationalContext, scope)

    const now = new Date().toISOString()
    await this.memoryStore.appendTurn(
      conversationId,
      {
        role: 'customer',
        text: unifiedMessage.text,
        createdAt: now,
        metadata: {
          channel: unifiedMessage.channel,
        },
      },
      scope,
    )
    await this.memoryStore.appendTurn(
      conversationId,
      {
        role: 'agent',
        text: annotatedResponse.text,
        createdAt: new Date().toISOString(),
        metadata: {
          provider: this.provider.providerName,
          toolCalls: annotatedResponse.toolCalls ?? [],
        },
      },
      scope,
    )

    return {
      conversationId,
      scope,
      provider: this.provider.providerName,
      model: this.provider.modelName,
      text: annotatedResponse.text,
      toolCalls: annotatedResponse.toolCalls ?? [],
      needsHuman: Boolean(annotatedResponse.needsHuman),
      grounding: {
        grounded:
          typeof annotatedResponse?.grounding?.grounded === 'boolean'
            ? annotatedResponse.grounding.grounded
            : retrievalContext.items.length > 0,
        fallbackReason:
          typeof annotatedResponse?.grounding?.fallbackReason === 'string'
            ? annotatedResponse.grounding.fallbackReason
            : annotatedResponse.needsHuman
              ? 'missing_approved_context'
              : null,
        sourceCount: retrievalContext.items.length,
        sources: retrievalContext.items.map((item) => ({
          id: item.id,
          title: item.title,
          scope: item.scope,
          sourceType: item.sourceType,
          score:
            typeof item.score === 'number' && Number.isFinite(item.score)
              ? item.score
              : null,
        })),
      },
    }
  }

  async getActionCatalog(scope) {
    const now = Date.now()
    if (now - this.actionCatalogLoadedAt > 60_000) {
      try {
        this.actionCatalog = await this.backendClient.getActions()
        this.actionCatalogLoadedAt = now
      } catch (error) {
        console.warn('[ai-agent-service] Unable to refresh action catalog', error)
      }
    }

    return (this.actionCatalog || []).filter(
      (entry) => !entry.scope || entry.scope === scope || scope === 'admin_internal',
    )
  }

  async getRetrievalContext(unifiedMessage, scope) {
    const text = unifiedMessage.text?.trim() || ''
    if (text.length < 4) {
      return { items: [] }
    }

    try {
      const response = await this.backendClient.searchKnowledge(
        text,
        scope,
        scope === 'admin_internal' ? 6 : 4,
        unifiedMessage.tenantKey,
      )
      return response ?? { items: [] }
    } catch (error) {
      console.warn('[ai-agent-service] Unable to retrieve knowledge context', error)
      return { items: [] }
    }
  }

  async getOperationalContext(unifiedMessage, scope, actionCatalog) {
    if (scope !== 'admin_internal') {
      return { items: [], toolCalls: [] }
    }

    const input = unifiedMessage.text?.trim()
    if (!input || input.length < 4) {
      return { items: [], toolCalls: [] }
    }

    const normalized = input.toLowerCase()
    const actionIntent = findActionIntent(normalized, actionCatalog)
    if (!actionIntent) {
      return { items: [], toolCalls: [] }
    }

    const executions = []
    const queueSearch = async (toolName, query) => {
      const cleanQuery = query?.trim()
      if (!cleanQuery || cleanQuery.length < 2) {
        return
      }
      try {
        let result = []
        if (toolName === 'search_customers') {
          result = await this.backendClient.searchCustomers(cleanQuery, 5)
        } else if (toolName === 'search_orders') {
          result = await this.backendClient.searchOrders(cleanQuery, 5, 'ORDER')
        } else if (toolName === 'search_quotes') {
          result = await this.backendClient.searchOrders(cleanQuery, 5, 'BUDGET')
        } else if (toolName === 'search_payments') {
          result = await this.backendClient.searchPayments(cleanQuery, 5)
        } else if (toolName === 'search_products') {
          result = await this.backendClient.searchProducts(cleanQuery, 5)
        } else if (toolName === 'search_categories') {
          result = await this.backendClient.searchCategories(cleanQuery, 5)
        }
        executions.push({
          name: toolName,
          arguments: { query: cleanQuery, limit: 5 },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: toolName,
          arguments: { query: cleanQuery, limit: 5 },
          result: null,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'preflight search failed',
        })
      }
    }

    const customerTerm = normalizeEntityQuery(extractNamedEntity(input, [
      /\b(?:cliente|para el cliente|para)\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|por|para|y|,|$))/iu,
      /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con|,|$))/iu,
      /\bpresupuesto\s+para\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con|,|$))/iu,
    ]))

    const productTerm = extractNamedEntity(input, [
      /\bproducto\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|por|y|,|$))/iu,
      /\b\d+\s+((?:rollers?\s+(?:screen|blackout))(?:\s+[a-záéíóúñ0-9-]+){0,4})(?=\s*(?:,|$))/iu,
      /\b((?:rollers?\s+(?:screen|blackout)|roller\s+(?:screen|blackout)|persianas?(?:\s+[a-záéíóúñ0-9-]+){0,4}|toldos?(?:\s+[a-záéíóúñ0-9-]+){0,4}|aberturas?(?:\s+[a-záéíóúñ0-9-]+){0,4}))(?=\s+(?:de|con|por|para|,|$))/iu,
    ])

    if (actionIntent.key === 'customers.update') {
      await queueSearch('search_customers', customerTerm || input)
    }

    if (actionIntent.key === 'categories.create') {
      await queueSearch('search_categories', input)
    }

    if (actionIntent.key === 'categories.update') {
      await queueSearch('search_categories', input)
    }

    if (actionIntent.key === 'orders.create' || actionIntent.key === 'quotes.create') {
      await queueSearch('search_customers', customerTerm || input)
      await queueSearch('search_products', productTerm || input)
    }

    if (actionIntent.key === 'payments.create') {
      const orderTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpedido\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con|,|$))/iu,
        ]),
      ) || customerTerm
      await queueSearch('search_orders', orderTerm || input)
      if (customerTerm) {
        await queueSearch('search_customers', customerTerm)
      }
    }

    if (actionIntent.key === 'orders.update_status') {
      const orderTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpedido\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con|,|$))/iu,
        ]),
      )
      await queueSearch('search_orders', orderTerm || customerTerm || input)
    }

    if (
      actionIntent.key === 'orders.update_comment' ||
      actionIntent.key === 'orders.update_structure'
    ) {
      const orderTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpedido\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por|,|$))/iu,
        ]),
      )
      await queueSearch('search_orders', orderTerm || customerTerm || input)
    }

    if (
      actionIntent.key === 'quotes.update_status' ||
      actionIntent.key === 'quotes.send' ||
      actionIntent.key === 'quotes.confirm' ||
      actionIntent.key === 'quotes.update_structure'
    ) {
      const quoteTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpresupuesto\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpresupuesto\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con|,|$))/iu,
        ]),
      )
      await queueSearch('search_quotes', quoteTerm || customerTerm || input)
    }

    if (actionIntent.key === 'quotes.update_comment') {
      const quoteTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpresupuesto\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpresupuesto\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por|,|$))/iu,
        ]),
      )
      await queueSearch('search_quotes', quoteTerm || customerTerm || input)
    }

    if (actionIntent.key === 'quotes.update_structure' || actionIntent.key === 'orders.update_structure') {
      await queueSearch('search_products', productTerm || input)
    }

    if (actionIntent.key === 'payments.update_status') {
      const paymentTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpago\s+((?:\d{2,}|[a-z0-9-]{4,}))(?=\s|$)/iu,
          /\bpago\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con|,|$))/iu,
        ]),
      )
      await queueSearch('search_payments', paymentTerm || input)
      if (customerTerm) {
        await queueSearch('search_customers', customerTerm)
      }
    }

    if (actionIntent.key === 'payments.update') {
      const paymentTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpago\s+((?:\d{2,}|[a-z0-9-]{4,}))(?=\s|$)/iu,
          /\bpago\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por|,|$))/iu,
        ]),
      )
      await queueSearch('search_payments', paymentTerm || input)
      if (customerTerm) {
        await queueSearch('search_customers', customerTerm)
      }
    }

    if (
      actionIntent.key === 'products.update' ||
      actionIntent.key === 'products.archive' ||
      actionIntent.key === 'products.adjust_stock' ||
      actionIntent.key === 'products.publish'
    ) {
      await queueSearch('search_products', productTerm || input)
    }

    if (actionIntent.key === 'aberturas.parse') {
      try {
        const result = await this.backendClient.parseAberturas({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: 'parse_aberturas',
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: 'parse_aberturas',
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'aberturas parse failed',
        })
      }
    }

    if (actionIntent.key === 'aberturas.register') {
      try {
        const result = await this.backendClient.prepareAberturasInsert({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: 'prepare_aberturas_insert',
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: 'prepare_aberturas_insert',
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'aberturas insert draft failed',
        })
      }
    }

    if (actionIntent.key === 'aberturas.prepare_quote') {
      try {
        const result = await this.backendClient.prepareAberturasQuote({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: 'prepare_aberturas_quote',
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: 'prepare_aberturas_quote',
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'aberturas quote draft failed',
        })
      }
    }

    const items = executions.map((entry) =>
        entry.status === 'failed'
          ? `${entry.name}: búsqueda previa fallida para "${entry.arguments.query || entry.arguments.text || 'la solicitud'}".`
          : summarizeResults(entry.name, entry.result),
      )
    const matches = executions
      .filter((entry) => {
        if (entry.status !== 'executed') {
          return false
        }
        if (
          entry.name === 'parse_aberturas' ||
          entry.name === 'prepare_aberturas_quote' ||
          entry.name === 'prepare_aberturas_insert'
        ) {
          return Boolean(entry.result?.itemCount)
        }
        return Array.isArray(entry.result) && entry.result.length > 0
      })
      .map((entry) => summarizeMatchesForUser(entry.name, entry.result))
      .filter(Boolean)

    return {
      items,
      matches,
      toolCalls: executions,
    }
  }

  annotateOperationalMatches(response, operationalContext, scope) {
    if (
      scope !== 'admin_internal' ||
      !Array.isArray(operationalContext?.matches) ||
      operationalContext.matches.length === 0 ||
      typeof response?.text !== 'string'
    ) {
      return response
    }

    if (/coincidencias encontradas|encontr[eé]|matches/i.test(response.text)) {
      return response
    }

    return {
      ...response,
      text: `Coincidencias encontradas: ${operationalContext.matches.join('; ')}.\n\n${response.text}`,
    }
  }

  applyGroundingFallback(input, scope, retrievalContext, response) {
    const hasToolCalls = Array.isArray(response?.toolCalls) && response.toolCalls.length > 0
    const hasApprovedContext =
      Array.isArray(retrievalContext?.items) && retrievalContext.items.length > 0
    const normalized = (input || '').trim().toLowerCase()

    if (hasToolCalls || hasApprovedContext || this.isLightweightGreeting(normalized)) {
      return response
    }

    if (scope === 'admin_internal') {
      return {
        ...response,
        text:
          'No tengo información aprobada suficiente para resolver esto con seguridad. Lo mejor es que un responsable del equipo continúe la gestión o que se cargue el conocimiento faltante antes de avanzar.',
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
          fallbackReason: 'missing_approved_context',
        },
      }
    }

    return {
      ...response,
      text:
        'No tengo información confirmada suficiente para responder eso con seguridad. Un asesor del equipo te indicará cómo continuar y te ayudará con el siguiente paso.',
      toolCalls: [],
      needsHuman: true,
      grounding: {
        grounded: false,
        fallbackReason: 'missing_approved_context',
      },
    }
  }

  isLightweightGreeting(input) {
    return [
      'hola',
      'buenas',
      'buen día',
      'buen dia',
      'buenas tardes',
      'buenas noches',
      'gracias',
      'ok',
    ].includes(input)
  }

  buildProviderSignature(config) {
    return JSON.stringify({
      provider: config?.modelProvider || null,
      model: config?.modelName || null,
      openAiApiKey: config?.openAiApiKey || '',
      updatedAt: config?.updatedAt || null,
    })
  }

  filterToolsForIntent(tools, actionIntent) {
    if (!Array.isArray(tools) || !actionIntent) {
      return tools
    }

    if (
      actionIntent.key === 'aberturas.parse' ||
      actionIntent.key === 'aberturas.register'
    ) {
      return tools.filter(
        (tool) =>
          tool.name !== 'prepare_aberturas_quote' &&
          (actionIntent.key !== 'aberturas.register' || tool.name !== 'parse_aberturas'),
      )
    }

    return tools
  }
}
