import { buildSystemPrompt } from './prompt/system-prompt.js'
import { createModelProvider } from './model/provider-factory.js'
import { getToolsForRole } from './tools/tool-registry.js'
import { z } from 'zod'
import {
  analyzeRoleResolution,
  canRoleExecuteIntent,
  canRoleUseTool,
  getRoleCatalog,
  getRoleConfig,
  normalizeRole,
  resolveRole,
  roleRequiresConfirmation,
  roleToScope,
} from './roles/role-runtime.js'
import { sanitizeUserInput } from './security/sanitize-input.js'

const STOP_TOKENS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'con',
  'sin',
  'para',
  'por',
  'que',
  'me',
  'mi',
  'tu',
  'su',
  'es',
  'en',
  'al',
  'lo',
  'se',
  'ya',
  'ahora',
  'necesito',
  'quiero',
  'hola',
  'buenas',
  'gracias',
])

const scopeForKnowledge = (scope) =>
  scope === 'customer_authenticated' ? 'customer_public' : scope

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractTopicTokens = (text) =>
  Array.from(
    new Set(
      normalizeText(text)
        .split(' ')
        .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token)),
    ),
  ).slice(0, 12)

const calculateTopicOverlap = (a = [], b = []) => {
  if (!a.length || !b.length) {
    return 0
  }

  const left = new Set(a)
  const right = new Set(b)
  let intersection = 0
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1
    }
  }
  return intersection / new Set([...left, ...right]).size
}

const explicitResetRequested = (text) =>
  /(nuevo caso|nuevo tema|otra consulta|otro tema|cambiando de tema|dejando eso|aparte|por otro lado)/i.test(
    String(text || ''),
  )

const looksLikeCustomerFollowUp = (text) =>
  /(ese mismo|esa misma|el mismo|la misma|mismo modelo|misma abertura|mismas caracteristicas|mismas características|ese modelo|esa abertura|ese producto|esa opcion|esa opción|puede venir|viene en|color negro|color blanco|incluye|tambien|también)/i.test(
    String(text || ''),
  )

const looksLikeAttachmentReference = (text) =>
  /(adjunto|archivo|pdf|imagen|captura|audio|voz|excel|planilla|csv|xlsx|foto|comprobante)/i.test(
    String(text || ''),
  )

const looksLikeContextualReference = (text) =>
  /(esto|eso|este|esta|ese|esa|lo de arriba|lo anterior|el anterior|la anterior|ese mismo|esa misma|registral[oa]s?|agregal[oa]s?|cargal[oa]s?|procesal[oa]s?|usalo|úsalo|usala|úsala|seg[uú]n|tomando lo anterior)/i.test(
    String(text || ''),
  )

const intentNamespace = (intentKey) => String(intentKey || '').split('.')[0] || 'other'

const hasExplicitConfirmation = (input) =>
  [
    /^confirmo$/i,
    /^confirmar$/i,
    /^autorizo$/i,
    /^adelante$/i,
    /^procede$/i,
    /^procede por favor$/i,
    /^procede con eso$/i,
    /^procede con la operacion$/i,
    /^procede con la operación$/i,
    /^procede con el cambio$/i,
    /^proced[ée]$/i,
    /^ejecuta$/i,
    /^si hacelo$/i,
    /^sí hacelo$/i,
    /^si confirmo$/i,
    /^sí confirmo$/i,
  ].some((pattern) => pattern.test(normalizeText(input)))

const isDebugModeEnabled = () => process.env.NODE_ENV !== 'production'

const extractProviderStatusCode = (error) => {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.cause?.status,
    error?.cause?.statusCode,
    error?.cause?.response?.status,
  ]

  for (const value of candidates) {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed >= 400 && parsed < 600) {
      return parsed
    }
  }

  const message = error instanceof Error ? error.message : String(error || '')
  const statusMatch = message.match(/(?:^|\b)(4\d{2}|5\d{2})(?:\b|$)/)
  if (statusMatch?.[1]) {
    return Number(statusMatch[1])
  }

  return null
}

const classifyProviderFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error || 'provider error')
  const normalized = message.toLowerCase()
  const statusCode = extractProviderStatusCode(error)

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    normalized.includes('invalid api key') ||
    normalized.includes('incorrect api key') ||
    normalized.includes('authentication') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return {
      reason: 'provider_auth_failed',
      statusCode,
      detail: 'Fallo de autenticación/autorización contra el proveedor.',
    }
  }

  if (
    normalized.includes('insufficient_quota') ||
    normalized.includes('quota exceeded') ||
    normalized.includes('exceeded your current quota') ||
    normalized.includes('billing hard limit') ||
    normalized.includes('credit balance') ||
    normalized.includes('saldo insuficiente') ||
    normalized.includes('cuota agotada')
  ) {
    return {
      reason: 'provider_quota_exceeded',
      statusCode,
      detail: 'La cuota o el crédito disponible del proveedor está agotado.',
    }
  }

  if (
    statusCode === 429 ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('requests per min') ||
    normalized.includes('tokens per min') ||
    normalized.includes('retry after')
  ) {
    return {
      reason: 'provider_rate_limited',
      statusCode,
      detail: 'El proveedor rechazó la solicitud por límite temporal de tasa o concurrencia.',
    }
  }

  if (
    normalized.includes('context length') ||
    normalized.includes('maximum context length') ||
    normalized.includes('too many tokens') ||
    normalized.includes('prompt is too long') ||
    normalized.includes('maximum number of tokens')
  ) {
    return {
      reason: 'provider_context_limit',
      statusCode,
      detail: 'La solicitud excedió el contexto o la cantidad máxima de tokens permitida por el modelo.',
    }
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('etimedout') ||
    normalized.includes('aborterror') ||
    normalized.includes('socket hang up')
  ) {
    return {
      reason: 'provider_timeout',
      statusCode,
      detail: 'La llamada al proveedor expiró antes de completarse.',
    }
  }

  if (
    statusCode === 400 ||
    statusCode === 422 ||
    normalized.includes('invalid_request_error') ||
    normalized.includes('bad request') ||
    normalized.includes('malformed')
  ) {
    return {
      reason: 'provider_bad_request',
      statusCode,
      detail: 'El proveedor rechazó la solicitud por formato o parámetros inválidos.',
    }
  }

  if (
    [500, 502, 503, 504].includes(statusCode) ||
    normalized.includes('service unavailable') ||
    normalized.includes('bad gateway') ||
    normalized.includes('gateway timeout') ||
    normalized.includes('internal server error') ||
    normalized.includes('temporarily unavailable')
  ) {
    return {
      reason: 'provider_unavailable',
      statusCode,
      detail: 'El proveedor estuvo temporalmente no disponible.',
    }
  }

  return {
    reason: 'provider_error',
    statusCode,
    detail: 'El proveedor devolvió un error no clasificado con suficiente precisión.',
  }
}

const deriveIntentKey = (role, input, actionIntent) => {
  if (actionIntent?.key) {
    return actionIntent.key
  }

  const normalized = normalizeText(input)

  if (String(role || '').startsWith('admin_') || role === 'superadmin') {
    if (/(abertura|aberturas|corrediza|batiente|dvh|monoblock|paño fijo|pano fijo)/.test(normalized)) {
      return 'aberturas.parse'
    }
    if (/(cliente|correo|telefono|direccion|dirección)/.test(normalized)) {
      return 'customers.manage'
    }
    if (/(presupuesto|cotizacion|cotizacion|quote)/.test(normalized)) {
      return 'quotes.manage'
    }
    if (/(pedido|orden)/.test(normalized)) {
      return 'orders.manage'
    }
    if (/(pago|cobro|transferencia)/.test(normalized)) {
      return 'payments.manage'
    }
    if (/(producto|categoria|categor[aí]a|stock)/.test(normalized)) {
      return 'catalog.manage'
    }
    return 'admin.other'
  }

  if (
    /(agregar|registrar|dar de alta|alta de|crear|cargar).*(abertura|aberturas|producto|productos).*(sistema|lista de productos)?/.test(
      normalized,
    )
  ) {
    return 'aberturas.register'
  }
  if (
    /(actualizar|editar|modificar|publicar|archivar|crear).*(producto|productos|categoria|categoría|stock)/.test(
      normalized,
    )
  ) {
    return 'catalog.manage'
  }
  if (
    /(actualizar|editar|modificar|registrar).*(cliente|correo|telefono|teléfono|direccion|dirección)/.test(
      normalized,
    )
  ) {
    return 'customers.manage'
  }
  if (/(presupuesto|cotizacion|cotizacion|precio|cuanto sale|cu[aá]nto sale)/.test(normalized)) {
    return 'customer.quote'
  }
  if (/(pedido|orden|estado|seguimiento|envio|envio|entrega)/.test(normalized)) {
    return 'customer.order_status'
  }
  if (/(producto|screen|blackout|roller|abertura|corrediza|batiente|ventana|puerta|dvh)/.test(normalized)) {
    return 'customer.product_info'
  }
  if (/(problema|soporte|reclamo|no funciona|ayuda)/.test(normalized)) {
    return 'customer.support'
  }
  if (/(hola|buenas|gracias|ok)/.test(normalized)) {
    return 'customer.light'
  }
  return 'customer.other'
}

const buildTaskSummary = (intentKey, turns = [], input = '') => {
  const recentTurns = turns
    .slice(-4)
    .map((turn) => `${turn.role}: ${String(turn.text || '').trim()}`)
    .filter(Boolean)

  const currentInput = String(input || '').trim()
  const parts = [`intención=${intentKey}`]
  if (recentTurns.length) {
    parts.push(`contexto_reciente=${recentTurns.join(' | ')}`)
  }
  if (currentInput) {
    parts.push(`consulta_actual=${currentInput}`)
  }
  return parts.join(' ; ')
}

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

const inferActionIntentFromConversationContext = (
  currentInput,
  contextualInput,
  actionCatalog = [],
) => {
  const normalizedCurrent = normalizeText(currentInput)
  const normalizedContext = normalizeText(contextualInput)

  const hasCreateVerb =
    /(agregar|agrega|agregalo|agregala|registrar|registralo|registrala|cargar|cargalo|cargala|dar de alta|alta)/.test(
      normalizedCurrent,
    )
  const hasQuoteVerb =
    /(cotizar|cotizacion|cotizacion|presupuesto|precio|cuanto sale|cuanto cuesta|pasame)/.test(
      normalizedCurrent,
    )
  const hasAberturasContext =
    /(abertura|aberturas|corrediza|batiente|dvh|monoblock|pano fijo|paño fijo)/.test(
      normalizedContext,
    )

  if (hasCreateVerb && hasAberturasContext) {
    return actionCatalog.find((entry) => entry?.key === 'aberturas.register') ?? null
  }

  if (hasQuoteVerb && hasAberturasContext) {
    return actionCatalog.find((entry) => entry?.key === 'aberturas.prepare_quote') ?? null
  }

  return null
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

const extractDimensionToken = (input) => {
  const match = String(input || '').match(/\b(\d{2,4})\s*[xX]\s*(\d{2,4})\b/u)
  if (!match?.[1] || !match?.[2]) {
    return null
  }
  return `${match[1]}x${match[2]}`
}

const buildCustomerProductSearchQuery = (input) => {
  const dimensionToken = extractDimensionToken(input)
  if (dimensionToken) {
    return dimensionToken
  }

  const seriesToken = extractNamedEntity(String(input || ''), [
    /\bserie\s+([a-záéíóúñ0-9-]+)\b/iu,
    /\b(probba|gala(?:\s+cr)?|monoblock|screen|blackout|roller|corrediza|batiente|ventana|puerta)\b/iu,
  ])

  return normalizeEntityQuery(seriesToken || String(input || ''))
}

const OPERATION_DRAFT_TOOL_NAME = '__operation_draft__'

const VERIFICATION_ROUTE_BUILDERS = {
  customer: (id) => `/app/crm/customer-details?id=${id}`,
  product: (id) => `/app/products/edit/${id}`,
  appointment: (id) => `/app/calendar/activities/details?id=${id}`,
  order: (id) => `/app/sales/order-details/${id}`,
  quote: (id) => `/app/sales/budget-details/${id}`,
  payment: (id) => `/app/accounting/payments?paymentId=${id}`,
}

const MAX_EXTRACTED_ASSETS = 4
const MAX_EXTRACTED_TEXT_LENGTH = 6000

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
    this.roleCatalog = getRoleCatalog()
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
        roleCatalog: getRoleCatalog(runtimeConfig.roleCatalog),
        updatedAt: runtimeConfig.updatedAt || null,
      }

      const currentSignature = this.buildProviderSignature(this.activeConfig)
      const nextSignature = this.buildProviderSignature(nextConfig)
      if (currentSignature !== nextSignature) {
        this.provider = createModelProvider(nextConfig)
      }
      this.activeConfig = nextConfig
      this.roleCatalog = getRoleCatalog(runtimeConfig.roleCatalog)
    } catch (error) {
      console.warn('[ai-agent-service] Unable to refresh runtime config', error)
      this.activeConfig = {
        ...this.config,
        enabled: true,
      }
      this.roleCatalog = getRoleCatalog()
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

  async resolveExtractedAssetContext(unifiedMessage, backendClient) {
    const attachments = Array.isArray(unifiedMessage?.attachments)
      ? unifiedMessage.attachments
      : Array.isArray(unifiedMessage?.metadata?.attachments)
        ? unifiedMessage.metadata.attachments
        : []

    const assets = attachments
      .filter((item) => item && typeof item === 'object')
      .slice(0, MAX_EXTRACTED_ASSETS)
      .map((item) => ({
        assetType: item.assetType || item.kind || null,
        fileName: item.fileName || item.filename || item.name || null,
        contentType: item.contentType || item.mimeType || null,
        content: item.content || null,
        textContent:
          item.textContent ||
          item.transcriptText ||
          item.ocrText ||
          item.rawText ||
          null,
        preferAi: item.preferAi !== false,
        metadata:
          item.metadata && typeof item.metadata === 'object'
            ? item.metadata
            : {
                transcriptText: item.transcriptText || null,
                ocrText: item.ocrText || null,
                rawText: item.rawText || null,
              },
      }))
      .filter(
        (item) =>
          item.content ||
          item.textContent ||
          item.metadata?.transcriptText ||
          item.metadata?.ocrText ||
          item.metadata?.rawText,
      )

    if (!assets.length || typeof backendClient?.extractAssets !== 'function') {
      return {
        items: [],
        appendedInput: null,
      }
    }

    try {
      const result = await backendClient.extractAssets({ assets })
      const items = Array.isArray(result?.items) ? result.items : []
      return {
        items,
        appendedInput: null,
      }
    } catch (error) {
      return {
        items: [
          {
            assetType: 'unknown',
            fileName: null,
            contentType: null,
            source: 'unparsed',
            stage: 'failed',
            rawText: null,
            normalizedText: null,
            structuredRows: [],
            warnings: [
              error instanceof Error
                ? error.message
                : 'attachment_extraction_failed',
            ],
            confidence: 0,
            requiresStructuredExtraction: false,
            usableForContext: false,
            debug: {
              byteLength: null,
              rowCount: 0,
              sheetCount: null,
              usedOpenAi: false,
              reason: 'attachment_extraction_failed',
            },
          },
        ],
        appendedInput: null,
      }
    }
  }

  buildInputWithExtractedAssets(input, extractedAssets = []) {
    const relevant = extractedAssets
      .filter((item) => item?.usableForContext && item?.normalizedText)
      .slice(0, MAX_EXTRACTED_ASSETS)

    if (!relevant.length) {
      return String(input || '')
    }

    const sections = relevant.map((item, index) => {
      const header = `[Adjunto ${index + 1}: ${item.fileName || item.assetType || 'archivo'}]`
      const text = String(item.normalizedText || '')
        .slice(0, MAX_EXTRACTED_TEXT_LENGTH)
        .trim()
      return `${header}\n${text}`
    })

    return [String(input || '').trim(), 'Contexto extraído desde adjuntos:', ...sections]
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }

  resolveInferenceContext({
    input,
    snapshot,
    extractedAssets = [],
    directActionIntent = null,
    directIntentKey = null,
  }) {
    const baseInput = String(input || '').trim()
    if (!baseInput || !Array.isArray(snapshot?.turns) || !snapshot.turns.length) {
      return {
        reasoningInput: baseInput,
        referencedMessages: [],
      }
    }

    const directIntentIsGeneric =
      directIntentKey === 'admin.other' || directIntentKey === 'customer.other'

    const shouldUseRecentContext =
      (!directActionIntent && directIntentIsGeneric) ||
      looksLikeContextualReference(baseInput) ||
      looksLikeAttachmentReference(baseInput) ||
      (extractedAssets.length > 0 &&
        !extractedAssets.some(
          (item) => item?.usableForContext && String(item?.normalizedText || '').trim(),
        ))

    if (!shouldUseRecentContext) {
      return {
        reasoningInput: baseInput,
        referencedMessages: [],
      }
    }

    const recentTurns = [...snapshot.turns]
      .reverse()
      .filter(
        (turn) =>
          turn?.role === 'customer' &&
          turn?.text &&
          !hasExplicitConfirmation(turn.text),
      )
      .sort((left, right) => {
        const leftHasAssets = Number(left?.metadata?.extractedAssetCount || 0) > 0
        const rightHasAssets = Number(right?.metadata?.extractedAssetCount || 0) > 0
        if (leftHasAssets === rightHasAssets) {
          return 0
        }
        return rightHasAssets ? 1 : -1
      })
      .slice(0, 3)

    if (!recentTurns.length) {
      return {
        reasoningInput: baseInput,
        referencedMessages: [],
      }
    }

    const contextBlock = [...recentTurns]
      .reverse()
      .map((turn, index) => {
        const messageId = turn?.metadata?.messageId ? ` id:${turn.metadata.messageId}` : ''
        return `[Mensaje reciente ${index + 1}${messageId}] ${String(turn.text).slice(0, 280)}`
      })
      .join('\n')

    return {
      reasoningInput: `${baseInput}\n\nContexto conversacional reciente relevante:\n${contextBlock}`.trim(),
      referencedMessages: recentTurns.map((turn) => ({
        messageId: turn?.metadata?.messageId || null,
        createdAt: turn?.createdAt || null,
        preview: String(turn?.text || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160),
        extractedAssetCount: Number(turn?.metadata?.extractedAssetCount || 0),
      })),
    }
  }

  countDraftOpenItems(draft) {
    if (!draft?.sections || !Array.isArray(draft.sections)) {
      return 0
    }
    return draft.sections.reduce((total, section) => {
      const title = normalizeText(section?.title)
      if (title !== 'faltantes' && title !== 'dudosos' && title !== 'pendientes') {
        return total
      }
      return total + (Array.isArray(section?.items) ? section.items.length : 0)
    }, 0)
  }

  buildStructuredExtractionSpec(actionIntent, input, extractedAssets = []) {
    if (!this.provider?.extractStructured || !actionIntent) {
      return null
    }

    const sourceBlocks = [String(input || '').trim()]
    for (const asset of extractedAssets) {
      if (asset?.usableForContext && asset?.normalizedText) {
        sourceBlocks.push(
          `[${asset.fileName || asset.assetType || 'adjunto'}]\n${String(asset.normalizedText).slice(
            0,
            4000,
          )}`,
        )
      }
    }
    const sourceText = sourceBlocks.filter(Boolean).join('\n\n').trim()
    if (!sourceText) {
      return null
    }

    if (actionIntent.key === 'customers.create' || actionIntent.key === 'customers.update') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de cliente desde el texto y devuelve campos estructurados. No inventes valores.',
        input: sourceText,
        schema: {
          name: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
          phoneNumber: z.string().nullable().optional(),
          location: z.string().nullable().optional(),
        },
        format: (result) => [
          result?.name ? `nombre: ${result.name}` : null,
          result?.email ? `email: ${result.email}` : null,
          result?.phoneNumber ? `telefono: ${result.phoneNumber}` : null,
          result?.location ? `ubicacion: ${result.location}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }

    if (actionIntent.key === 'products.create' || actionIntent.key === 'products.update') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de producto desde el texto y devuelve campos estructurados. No inventes valores.',
        input: sourceText,
        schema: {
          name: z.string().nullable().optional(),
          productCode: z.string().nullable().optional(),
          currency: z.string().nullable().optional(),
          salePrice: z.number().nullable().optional(),
          stock: z.number().int().nullable().optional(),
        },
        format: (result) => [
          result?.name ? `producto ${result.name}` : null,
          result?.productCode ? `codigo: ${result.productCode}` : null,
          result?.salePrice != null ? `precio ${result.salePrice}` : null,
          result?.currency ? `moneda: ${result.currency}` : null,
          result?.stock != null ? `stock ${result.stock}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }

    if (
      actionIntent.key === 'appointments.create' ||
      actionIntent.key === 'appointments.update'
    ) {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de una cita o actividad desde el texto y devuelve campos estructurados. No inventes valores.',
        input: sourceText,
        schema: {
          title: z.string().nullable().optional(),
          startDate: z.string().nullable().optional(),
          startTime: z.string().nullable().optional(),
          location: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.title ? `titulado ${result.title}` : null,
            result?.startDate && result?.startTime
              ? `para el ${result.startDate} a las ${result.startTime}`
              : null,
            result?.location ? `en ${result.location}` : null,
          ]
            .filter(Boolean)
            .join(' '),
      }
    }

    if (
      actionIntent.key === 'orders.update_status' ||
      actionIntent.key === 'quotes.update_status' ||
      actionIntent.key === 'payments.update_status'
    ) {
      const entityLabel =
        actionIntent.key === 'orders.update_status'
          ? 'pedido'
          : actionIntent.key === 'quotes.update_status'
            ? 'presupuesto'
            : 'pago'

      return {
        systemPrompt:
          `Extrae únicamente datos operativos para actualización de ${entityLabel}. Devuelve referencia de la entidad y nuevo estado en términos humanos. No inventes valores.`,
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
          statusText: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `${entityLabel} ${result.targetRef}`
              : result?.customerName
                ? `${entityLabel} de ${result.customerName}`
                : null,
            result?.statusText ? `estado ${result.statusText}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (
      actionIntent.key === 'orders.update_comment' ||
      actionIntent.key === 'quotes.update_comment'
    ) {
      const entityLabel =
        actionIntent.key === 'orders.update_comment' ? 'pedido' : 'presupuesto'

      return {
        systemPrompt:
          `Extrae únicamente datos operativos para comentario de ${entityLabel}. Devuelve referencia de la entidad y comentario final. No inventes valores.`,
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
          comment: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `${entityLabel} ${result.targetRef}`
              : result?.customerName
                ? `${entityLabel} de ${result.customerName}`
                : null,
            result?.comment ? `comentario ${result.comment}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (actionIntent.key === 'quotes.send' || actionIntent.key === 'quotes.confirm') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de un presupuesto para enviarlo o confirmarlo. Devuelve referencia del presupuesto o nombre del cliente si aparece. No inventes valores.',
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `presupuesto ${result.targetRef}`
              : result?.customerName
                ? `presupuesto de ${result.customerName}`
                : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (actionIntent.key === 'payments.update') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de actualización de pago. Devuelve referencia del pago, método, referencia externa y notas si existen. No inventes valores.',
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
          method: z.string().nullable().optional(),
          reference: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `pago ${result.targetRef}`
              : result?.customerName
                ? `pago de ${result.customerName}`
                : null,
            result?.method ? `metodo ${result.method}` : null,
            result?.reference ? `referencia ${result.reference}` : null,
            result?.notes ? `nota ${result.notes}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (
      actionIntent.key === 'aberturas.register' ||
      actionIntent.key === 'aberturas.prepare_quote' ||
      actionIntent.key === 'aberturas.parse'
    ) {
      return {
        systemPrompt:
          'Separa cada abertura o item cotizable en una línea independiente y preserva solo los datos presentes: tipo, serie, color, vidrio, medidas y precio. No inventes datos faltantes ni mezcles atributos entre líneas.',
        input: sourceText,
        schema: {
          lines: z.array(z.string()).max(20).optional(),
        },
        format: (result) =>
          Array.isArray(result?.lines)
            ? result.lines
                .map((line) => String(line || '').trim())
                .filter(Boolean)
                .join('\n')
            : '',
      }
    }

    return null
  }

  async maybeRefineDraftWithStructuredExtraction({
    role,
    actionIntent,
    actionCatalog,
    input,
    extractedAssets,
    operationalContext,
    draft,
    backendClient,
  }) {
    const spec = this.buildStructuredExtractionSpec(
      actionIntent,
      input,
      extractedAssets,
    )
    if (!spec) {
      return {
        draft,
        operationalContext,
      }
    }

    const currentGaps = this.countDraftOpenItems(draft)
    if (draft?.ready && currentGaps === 0) {
      return {
        draft,
        operationalContext,
      }
    }

    try {
      const structured = await this.provider.extractStructured({
        systemPrompt: spec.systemPrompt,
        input: spec.input,
        schema: spec.schema,
      })
      const hintText = spec.format(structured)
      if (!hintText) {
        return {
          draft,
          operationalContext,
        }
      }

      const rebuiltInput = `${input}\n${hintText}`.trim()
      const rebuiltOperationalContext = await this.getOperationalContext(
        { text: rebuiltInput },
        role,
        actionCatalog,
        backendClient,
      )
      const rebuiltDraft = this.buildOperationDraft(
        actionIntent,
        rebuiltInput,
        rebuiltOperationalContext,
        extractedAssets,
      )

      if (!rebuiltDraft) {
        return {
          draft,
          operationalContext,
        }
      }

      const rebuiltGaps = this.countDraftOpenItems(rebuiltDraft)
      if (rebuiltDraft.ready || rebuiltGaps < currentGaps) {
        rebuiltDraft.debugDetail = [
          rebuiltDraft.debugDetail,
          'Se agregó extracción estructurada IA para completar campos ambiguos.',
        ]
          .filter(Boolean)
          .join(' ')
        return {
          draft: rebuiltDraft,
          operationalContext: rebuiltOperationalContext,
        }
      }
      return {
        draft,
        operationalContext,
      }
    } catch {
      return {
        draft,
        operationalContext,
      }
    }
  }

  async respond(unifiedMessage) {
    const runtimeConfig = await this.refreshRuntimeConfig()
    if (runtimeConfig.enabled === false) {
      const disabledRole = resolveRole(unifiedMessage, this.roleCatalog)
      return {
        conversationId: unifiedMessage.conversationId || unifiedMessage.userId,
        scope: roleToScope(disabledRole, this.roleCatalog),
        role: disabledRole,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text:
          runtimeConfig.usageMessage ||
          'El asistente está temporalmente deshabilitado. Un operador puede continuar la atención.',
        toolCalls: [],
        audit: {
          role: disabledRole,
          intentKey: null,
          blockedTools: [],
          executedTools: [],
          fallbackActivated: true,
          taskChanged: false,
          createdAt: new Date().toISOString(),
        },
      }
    }

    const conversationId = unifiedMessage.conversationId || unifiedMessage.userId
    const sanitizedInput = sanitizeUserInput(unifiedMessage.text)
    const role = resolveRole(unifiedMessage, this.roleCatalog)
    const roleConfig = getRoleConfig(role, this.roleCatalog)
    const roleResolution = analyzeRoleResolution(unifiedMessage, this.roleCatalog)
    const scope = roleToScope(role, this.roleCatalog)
    const scopedBackendClient = this.backendClient.scoped(role)
    const snapshot = await this.memoryStore.get(conversationId)
    const previousSnapshot = snapshot ? structuredClone(snapshot) : null
    const actionCatalog = await this.getActionCatalog(role)
    const extractedAssetContext = await this.resolveExtractedAssetContext(
      unifiedMessage,
      scopedBackendClient,
    )
    const effectiveInput =
      Array.isArray(extractedAssetContext.items) && extractedAssetContext.items.length
        ? this.buildInputWithExtractedAssets(
            sanitizedInput.sanitized,
            extractedAssetContext.items,
          )
        : sanitizedInput.sanitized
    const directActionIntent = findActionIntent(
      String(normalizeText(effectiveInput) || '').toLowerCase(),
      actionCatalog,
    )
    const directIntentKey = deriveIntentKey(role, effectiveInput, directActionIntent)
    const inferenceContext = this.resolveInferenceContext({
      input: effectiveInput,
      snapshot: previousSnapshot ?? snapshot,
      extractedAssets: extractedAssetContext.items,
      directActionIntent,
      directIntentKey,
    })
    const reasoningInput = inferenceContext.reasoningInput || effectiveInput
    const actionIntent =
      directActionIntent ||
      inferActionIntentFromConversationContext(
        effectiveInput,
        reasoningInput,
        actionCatalog,
      ) ||
      findActionIntent(String(normalizeText(reasoningInput) || '').toLowerCase(), actionCatalog)
    const intentKey = deriveIntentKey(role, reasoningInput, actionIntent)
    const taskMemory = this.resolveTaskMemory(
      snapshot,
      conversationId,
      role,
      scope,
      effectiveInput,
      actionIntent,
    )
    await this.memoryStore.replace(conversationId, taskMemory.snapshot)
    const hardInjectionBlock =
      sanitizedInput.injectionDetected &&
      /(prompt|tools?|herramientas?|datos internos|configuraci[oó]n|act[uú]a como admin|admin)/i.test(
        sanitizedInput.original,
      )
    if (hardInjectionBlock) {
      const fallback = this.buildRoleBlockedResponse(role, roleResolution)
      return {
        conversationId,
        scope,
        role,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text: fallback,
        toolCalls: [],
        needsHuman: roleConfig.type === 'customer',
        grounding: {
          grounded: false,
          fallbackReason: 'prompt_injection_blocked',
          sourceCount: 0,
          sources: [],
        },
        memory: {
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          taskSummary: taskMemory.taskSummary,
          currentTask: taskMemory.currentTask,
          resetApplied: taskMemory.resetApplied,
          resetCount: taskMemory.resetCount,
          lastResetAt: taskMemory.lastResetAt,
          historyTurnCount: taskMemory.history.length,
        },
        audit: {
          role,
          intentKey: taskMemory.intentKey,
          roleResolutionMode: roleResolution.mode,
          blockedTools: [],
          executedTools: [],
          fallbackActivated: true,
          taskChanged: taskMemory.resetApplied,
          createdAt: new Date().toISOString(),
        },
      }
    }
    const intentAllowed = canRoleExecuteIntent(role, intentKey, this.roleCatalog)
    const baseTools = getToolsForRole(roleConfig, scopedBackendClient)
    const { tools, blockedTools } = this.filterToolsForIntent(
      baseTools,
      actionIntent,
      role,
      effectiveInput,
    )
    const requestedToolName = actionIntent?.toolName ?? null
    const requestedToolRequiresConfirmation =
      requestedToolName &&
      roleRequiresConfirmation(role, requestedToolName, this.roleCatalog) &&
      !hasExplicitConfirmation(sanitizedInput.sanitized)
    const requestedToolBlocked =
      Boolean(requestedToolName) &&
      blockedTools.includes(requestedToolName) &&
      !tools.some((tool) => tool.name === requestedToolName) &&
      !requestedToolRequiresConfirmation
    const history = taskMemory.history
    const retrievalContext = await this.getRetrievalContext(
      { ...unifiedMessage, text: reasoningInput },
      role,
      scope,
      scopedBackendClient,
    )
    const operationalContext = await this.getOperationalContext(
      { ...unifiedMessage, text: reasoningInput },
      role,
      actionCatalog,
      scopedBackendClient,
      actionIntent,
    )

    const confirmationResponse = await this.tryExecutePendingConfirmation({
      snapshot: previousSnapshot,
      taskMemory,
      conversationId,
      role,
      scope,
      input: effectiveInput,
      backendClient: scopedBackendClient,
    })
    if (confirmationResponse) {
      const responseWithDebug = this.appendAdminDebugSummary(confirmationResponse, {
        stage: 'confirmation_execution',
        role,
        input: sanitizedInput.sanitized,
        intentKey: taskMemory.intentKey,
        actionKey: confirmationResponse.debug?.actionKey ?? null,
        blockedTools,
        toolCalls: confirmationResponse.toolCalls ?? [],
        detail: confirmationResponse.debug?.detail ?? null,
      })

      const now = new Date().toISOString()
      await this.memoryStore.appendTurn(
        conversationId,
        {
          role: 'customer',
          text:
            extractedAssetContext.items.length > 0
              ? effectiveInput
              : sanitizedInput.sanitized,
          createdAt: now,
          metadata: {
            channel: unifiedMessage.channel,
            messageId: unifiedMessage.messageId || null,
            taskId: taskMemory.taskId,
            intentKey: taskMemory.intentKey,
            role,
            injectionDetected: sanitizedInput.injectionDetected,
          },
        },
        scope,
        role,
      )
      await this.memoryStore.appendTurn(
        conversationId,
        {
          role: 'agent',
          text: responseWithDebug.text,
          createdAt: new Date().toISOString(),
          metadata: {
            provider: this.provider.providerName,
            toolCalls: responseWithDebug.toolCalls ?? [],
            taskId: taskMemory.taskId,
            intentKey: taskMemory.intentKey,
            role,
          },
        },
        scope,
        role,
      )

      return {
        conversationId,
        scope,
        role,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text: responseWithDebug.text,
        toolCalls: responseWithDebug.toolCalls ?? [],
        needsHuman: Boolean(responseWithDebug.needsHuman),
        grounding: {
          grounded: false,
          fallbackReason:
            typeof responseWithDebug?.grounding?.fallbackReason === 'string'
              ? responseWithDebug.grounding.fallbackReason
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
        memory: {
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          taskSummary: taskMemory.taskSummary,
          currentTask: taskMemory.currentTask,
          resetApplied: taskMemory.resetApplied,
          resetCount: taskMemory.resetCount,
          lastResetAt: taskMemory.lastResetAt,
          historyTurnCount: taskMemory.history.length,
        },
        audit: {
          role,
          intentKey: taskMemory.intentKey,
          blockedTools,
          executedTools: (responseWithDebug.toolCalls ?? [])
            .filter((entry) => entry?.status === 'executed' && entry?.name)
            .map((entry) => entry.name),
          fallbackActivated: Boolean(responseWithDebug.needsHuman),
          taskChanged: taskMemory.resetApplied,
          createdAt: new Date().toISOString(),
        },
      }
    }

    if (!intentAllowed) {
      const fallback = this.buildRoleBlockedResponse(role, roleResolution)
      const debugResponse = this.appendAdminDebugSummary(
        {
          text: fallback,
          toolCalls: [],
          needsHuman: roleConfig.type === 'customer',
          grounding: {
            grounded: false,
            fallbackReason: roleResolution.ambiguous
              ? 'role_resolution_ambiguous'
              : 'role_intent_blocked',
          },
        },
        {
          stage: 'policy_block',
          role,
          input: sanitizedInput.sanitized,
          intentKey,
          actionKey: actionIntent?.key ?? null,
          blockedTools,
          detail: roleResolution.ambiguous
            ? 'Configuración amplia o ambigua de grupos/capacidades.'
            : 'El intent detectado no está habilitado para el rol conversacional resuelto.',
        },
      )
      return {
        conversationId,
        scope,
        role,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text: debugResponse.text,
        toolCalls: [],
        needsHuman: roleConfig.type === 'customer',
        grounding: {
          grounded: false,
          fallbackReason: roleResolution.ambiguous
            ? 'role_resolution_ambiguous'
            : 'role_intent_blocked',
          sourceCount: retrievalContext.items.length,
          sources: [],
        },
        memory: {
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          taskSummary: taskMemory.taskSummary,
          currentTask: taskMemory.currentTask,
          resetApplied: taskMemory.resetApplied,
          resetCount: taskMemory.resetCount,
          lastResetAt: taskMemory.lastResetAt,
          historyTurnCount: taskMemory.history.length,
        },
        audit: {
          role,
          intentKey,
          roleResolutionMode: roleResolution.mode,
          blockedTools,
          executedTools: [],
          fallbackActivated: true,
          taskChanged: taskMemory.resetApplied,
          createdAt: new Date().toISOString(),
        },
      }
    }

    if (requestedToolBlocked) {
      const fallback = this.buildRoleBlockedResponse(role, roleResolution)
      const debugResponse = this.appendAdminDebugSummary(
        {
          text: fallback,
          toolCalls: [],
          needsHuman: roleConfig.type === 'customer',
          grounding: {
            grounded: false,
            fallbackReason: roleResolution.ambiguous
              ? 'role_resolution_ambiguous'
              : 'role_tool_blocked',
          },
        },
        {
          stage: 'tool_block',
          role,
          input: sanitizedInput.sanitized,
          intentKey,
          actionKey: actionIntent?.key ?? null,
          blockedTools,
          detail: requestedToolRequiresConfirmation
            ? 'La tool requiere confirmación explícita antes de ejecutarse.'
            : `La tool solicitada (${requestedToolName || 'n/a'}) no quedó habilitada para este rol.`,
        },
      )
      return {
        conversationId,
        scope,
        role,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text: debugResponse.text,
        toolCalls: [],
        needsHuman: roleConfig.type === 'customer',
        grounding: {
          grounded: false,
          fallbackReason: roleResolution.ambiguous
            ? 'role_resolution_ambiguous'
            : 'role_tool_blocked',
          sourceCount: retrievalContext.items.length,
          sources: [],
        },
        memory: {
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          taskSummary: taskMemory.taskSummary,
          currentTask: taskMemory.currentTask,
          resetApplied: taskMemory.resetApplied,
          resetCount: taskMemory.resetCount,
          lastResetAt: taskMemory.lastResetAt,
          historyTurnCount: taskMemory.history.length,
        },
        audit: {
          role,
          intentKey,
          roleResolutionMode: roleResolution.mode,
          blockedTools,
          executedTools: [],
          fallbackActivated: true,
          taskChanged: taskMemory.resetApplied,
          createdAt: new Date().toISOString(),
        },
      }
    }

    const deterministicResult = await this.buildDeterministicOperationalResponse({
      role,
      input: reasoningInput,
      actionIntent,
      actionCatalog,
      operationalContext,
      extractedAssets: extractedAssetContext.items,
      requestedToolRequiresConfirmation,
      backendClient: scopedBackendClient,
    })
    const resolvedOperationalContext =
      deterministicResult?.operationalContext ?? operationalContext

    let generatedResponse
    if (deterministicResult) {
      generatedResponse = deterministicResult.response
    } else {
      try {
        generatedResponse = await this.provider.generate({
          role,
          systemPrompt: buildSystemPrompt(role, {
            actionCatalog,
            retrievalContext: retrievalContext.items,
            operationalContext: resolvedOperationalContext.items,
            taskSummary: taskMemory.taskSummary,
            currentTask: taskMemory.currentTask,
            blockedTools,
            customInstructions:
              roleConfig.type === 'admin'
                ? runtimeConfig.adminInternalPrompt
                : runtimeConfig.customerPublicPrompt,
          }),
          history,
          input: reasoningInput,
          tools,
          actionCatalog,
          retrievalContext: retrievalContext.items,
        })
      } catch (error) {
        const providerFailure = classifyProviderFailure(error)
        const fallbackReason = providerFailure.reason

        const recoveredCustomerResponse = this.buildCustomerSearchFallbackResponse({
          role,
          intentKey: taskMemory.intentKey,
          operationalContext,
          fallbackReason,
        })
        if (recoveredCustomerResponse) {
          generatedResponse = recoveredCustomerResponse
        } else {
          generatedResponse = {
            text:
              roleConfig.type === 'admin'
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

        generatedResponse = this.appendAdminDebugSummary(generatedResponse, {
          stage: 'provider_generation',
          role,
          input: reasoningInput,
          intentKey: taskMemory.intentKey,
          actionKey: actionIntent?.key ?? null,
          blockedTools,
          toolCalls: resolvedOperationalContext.toolCalls ?? [],
          referencedMessages: inferenceContext.referencedMessages,
          detail: `Fallo en la etapa de generación del modelo: ${fallbackReason}${providerFailure.statusCode ? ` (HTTP ${providerFailure.statusCode})` : ''}. ${providerFailure.detail}`,
        })
      }
    }

    const response = this.applyGroundingFallback(
      effectiveInput,
      role,
      retrievalContext,
      {
        ...generatedResponse,
        toolCalls: [
          ...(resolvedOperationalContext.toolCalls ?? []),
          ...(generatedResponse.toolCalls ?? []),
        ],
      },
    )
    const annotatedResponse = this.appendAdminDebugSummary(
      this.annotateOperationalMatches(response, resolvedOperationalContext, role),
      {
        stage: deterministicResult ? 'deterministic_decision' : 'llm_response',
        role,
        input: reasoningInput,
        intentKey: taskMemory.intentKey,
        actionKey: actionIntent?.key ?? null,
        blockedTools,
        toolCalls: [
          ...(resolvedOperationalContext.toolCalls ?? []),
          ...(response.toolCalls ?? []),
        ],
        referencedMessages: inferenceContext.referencedMessages,
        detail: deterministicResult
          ? `La respuesta se resolvió por flujo determinístico de backend${extractedAssetContext.items.length ? ' usando contexto extraído de adjuntos' : ''} para evitar depender del modelo.`
          : 'La respuesta final se generó con el modelo sobre el contexto operativo y documental disponible.',
      },
    )
    const executedToolNames = (annotatedResponse.toolCalls ?? [])
      .filter((entry) => entry?.status === 'executed' && entry?.name)
      .map((entry) => entry.name)
    const audit = {
      role,
      intentKey: taskMemory.intentKey,
      blockedTools,
      executedTools: executedToolNames,
      fallbackActivated: Boolean(annotatedResponse.needsHuman),
      taskChanged: taskMemory.resetApplied,
      referencedMessages: inferenceContext.referencedMessages,
      createdAt: new Date().toISOString(),
    }

    const now = new Date().toISOString()
    await this.memoryStore.appendTurn(
      conversationId,
      {
        role: 'customer',
        text:
          extractedAssetContext.items.length > 0
            ? effectiveInput
            : sanitizedInput.sanitized,
        createdAt: now,
        metadata: {
          channel: unifiedMessage.channel,
          messageId: unifiedMessage.messageId || null,
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          role,
          injectionDetected: sanitizedInput.injectionDetected,
          extractedAssetCount: extractedAssetContext.items.length,
        },
      },
      scope,
      role,
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
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          role,
          extractedAssetCount: extractedAssetContext.items.length,
        },
      },
      scope,
      role,
    )

    return {
      conversationId,
      scope,
      role,
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
      memory: {
        taskId: taskMemory.taskId,
        intentKey: taskMemory.intentKey,
        taskSummary: taskMemory.taskSummary,
        currentTask: taskMemory.currentTask,
        resetApplied: taskMemory.resetApplied,
        resetCount: taskMemory.resetCount,
        lastResetAt: taskMemory.lastResetAt,
        historyTurnCount: taskMemory.history.length,
      },
      audit,
    }
  }

  async getActionCatalog(role) {
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
      (entry) =>
        !Array.isArray(entry.allowedRoles) ||
        entry.allowedRoles.length === 0 ||
        entry.allowedRoles.includes(role),
    )
  }

  async getRetrievalContext(unifiedMessage, role, scope, backendClient = this.backendClient) {
    const text = unifiedMessage.text?.trim() || ''
    if (text.length < 4) {
      return { items: [] }
    }

    try {
      const response = await backendClient.searchKnowledge(
        text,
        scopeForKnowledge(scope),
        role.startsWith('admin_') || role === 'superadmin' ? 6 : 4,
        unifiedMessage.tenantKey,
      )
      return response ?? { items: [] }
    } catch (error) {
      console.warn('[ai-agent-service] Unable to retrieve knowledge context', error)
      return { items: [] }
    }
  }

  async getOperationalContext(
    unifiedMessage,
    role,
    actionCatalog,
    backendClient = this.backendClient,
    resolvedActionIntent = null,
  ) {
    const input = unifiedMessage.text?.trim()
    if (!input || input.length < 4) {
      return { items: [], toolCalls: [] }
    }

    const normalized = input.toLowerCase()
    const actionIntent = resolvedActionIntent || findActionIntent(normalized, actionCatalog)
    const executions = []
    const queueSearch = async (toolName, query) => {
      const cleanQuery = query?.trim()
      if (!cleanQuery || cleanQuery.length < 2) {
        return
      }
      try {
        let result = []
        if (toolName === 'search_customers') {
          result = await backendClient.searchCustomers(cleanQuery, 5)
        } else if (toolName === 'search_orders') {
          result = await backendClient.searchOrders(cleanQuery, 5, 'ORDER')
        } else if (toolName === 'search_quotes') {
          result = await backendClient.searchOrders(cleanQuery, 5, 'BUDGET')
        } else if (toolName === 'search_payments') {
          result = await backendClient.searchPayments(cleanQuery, 5)
        } else if (toolName === 'search_appointments') {
          result = await backendClient.searchAppointments(cleanQuery, 5)
        } else if (toolName === 'search_products') {
          result = await backendClient.searchProducts(cleanQuery, 5)
        } else if (toolName === 'search_categories') {
          result = await backendClient.searchCategories(cleanQuery, 5)
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

    const buildContextPayload = () => {
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

    const productTerm = extractNamedEntity(input, [
      /\bproducto\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|por|y|,|$))/iu,
      /\b\d+\s+((?:rollers?\s+(?:screen|blackout))(?:\s+[a-záéíóúñ0-9-]+){0,4})(?=\s*(?:,|$))/iu,
      /\b((?:rollers?\s+(?:screen|blackout)|roller\s+(?:screen|blackout)|persianas?(?:\s+[a-záéíóúñ0-9-]+){0,4}|toldos?(?:\s+[a-záéíóúñ0-9-]+){0,4}|aberturas?(?:\s+[a-záéíóúñ0-9-]+){0,4}))(?=\s+(?:de|con|por|para|,|$))/iu,
    ])

    if (!(role.startsWith('admin_') || role === 'superadmin')) {
      const customerIntent = deriveIntentKey(role, input, actionIntent)
      if (
        customerIntent === 'customer.quote' ||
        customerIntent === 'customer.product_info'
      ) {
        await queueSearch(
          'search_products',
          buildCustomerProductSearchQuery(productTerm || input),
        )
      }
      return buildContextPayload()
    }

    if (!actionIntent) {
      return { items: [], toolCalls: [] }
    }

    const customerTerm = normalizeEntityQuery(extractNamedEntity(input, [
      /\b(?:cliente|para el cliente|para)\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|por|para|y)\b|,|$)/iu,
      /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con)\b|,|$)/iu,
      /\bpresupuesto\s+para\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con)\b|,|$)/iu,
    ]))

    if (actionIntent.key === 'customers.update') {
      await queueSearch('search_customers', customerTerm || input)
    }

    if (
      actionIntent.key === 'appointments.update' ||
      actionIntent.key === 'appointments.delete'
    ) {
      await queueSearch('search_appointments', input)
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
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con)\b|,|$)/iu,
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
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con)\b|,|$)/iu,
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
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por)\b|,|$)/iu,
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
          /\bpresupuesto\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con)\b|,|$)/iu,
        ]),
      )
      await queueSearch('search_quotes', quoteTerm || customerTerm || input)
    }

    if (actionIntent.key === 'quotes.update_comment') {
      const quoteTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpresupuesto\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpresupuesto\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por)\b|,|$)/iu,
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
          /\bpago\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con)\b|,|$)/iu,
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
          /\bpago\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por)\b|,|$)/iu,
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
        const result = await backendClient.parseAberturas({
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
        const result = await backendClient.prepareAberturasInsert({
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
        const result = await backendClient.prepareAberturasQuote({
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

    return buildContextPayload()
  }

  annotateOperationalMatches(response, operationalContext, role) {
    if (
      !(role.startsWith('admin_') || role === 'superadmin') ||
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

  applyGroundingFallback(input, role, retrievalContext, response) {
    const hasToolCalls = Array.isArray(response?.toolCalls) && response.toolCalls.length > 0
    const hasApprovedContext =
      Array.isArray(retrievalContext?.items) && retrievalContext.items.length > 0
    const normalized = (input || '').trim().toLowerCase()

    if (typeof response?.grounding?.fallbackReason === 'string') {
      return response
    }

    if (hasToolCalls || hasApprovedContext || this.isLightweightGreeting(normalized)) {
      return response
    }

    if (role.startsWith('admin_') || role === 'superadmin') {
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

  filterToolsForIntent(tools, actionIntent, role, input) {
    if (!Array.isArray(tools)) {
      return { tools: [], blockedTools: [] }
    }

    const blockedTools = []
    if (!actionIntent) {
      return { tools, blockedTools }
    }

    const searchTools = tools.filter((tool) => tool.name.startsWith('search_'))
    const allowedNames = new Set(searchTools.map((tool) => tool.name))
    if (actionIntent.toolName) {
      allowedNames.add(actionIntent.toolName)
    }

    if (
      actionIntent.key === 'aberturas.parse' ||
      actionIntent.key === 'aberturas.register'
    ) {
      for (const tool of tools) {
        if (tool.name === 'prepare_aberturas_quote') {
          blockedTools.push(tool.name)
          allowedNames.delete(tool.name)
        }
        if (actionIntent.key === 'aberturas.register' && tool.name === 'parse_aberturas') {
          blockedTools.push(tool.name)
          allowedNames.delete(tool.name)
        }
      }
    }

    const requiresConfirmation =
      actionIntent.toolName &&
      roleRequiresConfirmation(role, actionIntent.toolName, this.roleCatalog)
    if (requiresConfirmation && !hasExplicitConfirmation(input)) {
      blockedTools.push(actionIntent.toolName)
      allowedNames.delete(actionIntent.toolName)
    }

    const filteredTools = tools.filter(
      (tool) =>
        allowedNames.has(tool.name) &&
        canRoleUseTool(role, tool.name, this.roleCatalog),
    )

    if (
      actionIntent?.toolName &&
      !filteredTools.some((tool) => tool.name === actionIntent.toolName) &&
      !blockedTools.includes(actionIntent.toolName)
    ) {
      blockedTools.push(actionIntent.toolName)
    }

    return {
      tools: filteredTools,
      blockedTools: Array.from(new Set(blockedTools)),
    }
  }

  buildAberturasRegisterDraft(actionIntent, operationalContext) {
    const insertDraft = this.getExecutedToolResult(
      operationalContext?.toolCalls,
      'prepare_aberturas_insert',
    )

    if (!insertDraft) {
      return null
    }

    const readyItems = Array.isArray(insertDraft.items)
      ? insertDraft.items.filter((item) => item?.validForInsert && item?.insertPayload)
      : []
    const pendingItems = Array.isArray(insertDraft.items)
      ? insertDraft.items.filter((item) => !item?.validForInsert)
      : []

    return {
      actionKey: actionIntent.key,
      ready: readyItems.length > 0,
      intro: 'He preparado la alta al sistema de las aberturas detectadas.',
      sections: [
        {
          title: 'Listas para alta',
          items: readyItems.map((item) => {
            const price = item?.insertPayload?.salePrice ?? item?.price ?? null
            const currency =
              item?.insertPayload?.currency ?? item?.currency ?? null
            return `${item?.lineNumber || '?'}. ${item?.familyId || 'sin familia'} ${item?.serie || 'sin serie'} ${item?.widthMm || '?'}x${item?.heightMm || '?'}${currency && price != null ? ` ${currency} ${price}` : ''}`.trim()
          }),
        },
        {
          title: 'Pendientes',
          items: pendingItems.map((item) => {
            const missing = Array.isArray(item?.missingFields) && item.missingFields.length
              ? item.missingFields
              : [
                  item?.price == null ? 'price' : null,
                  !item?.currency ? 'currency' : null,
                ].filter(Boolean)
            return `${item?.lineNumber || '?'}. ${item?.familyId || 'sin familia'} ${item?.serie || 'sin serie'} ${item?.widthMm || '?'}x${item?.heightMm || '?'}: falta ${missing.join(', ') || 'revisión manual'}`
          }),
        },
      ],
      confirmationPrompt:
        '¿Deseas agregar al sistema los ítems válidos? Si confirmas, crearé los productos y te devolveré el enlace al detalle.',
      pendingPrompt:
        'Todavía no hay ítems suficientes para completar el alta. Corrige los faltantes y vuelve a intentarlo.',
      execute: {
        type: 'batch',
        items: readyItems.map((item) => ({
          toolName: 'create_product',
          payload: item.insertPayload,
          verifyEntity: 'product',
          successLabel: item.insertPayload?.name || `${item?.familyId || 'Abertura'} ${item?.serie || ''}`.trim(),
        })),
      },
      batchSuccessTitle: 'Alta ejecutada correctamente para los siguientes productos:',
      debugDetail: `Se usó prepare_aberturas_insert sobre el texto de entrada. Ítems listos: ${readyItems.length}. Ítems pendientes: ${pendingItems.length}.`,
    }
  }

  buildAppointmentCreateDraft(actionIntent, input) {
    const appointmentDraft = this.extractAppointmentDraft(input)
    const confirmed = []
    const missing = []

    if (appointmentDraft.title) {
      confirmed.push(`título: ${appointmentDraft.title}`)
    } else {
      missing.push('título')
    }

    if (appointmentDraft.startLabel) {
      confirmed.push(`inicio: ${appointmentDraft.startLabel}`)
    } else {
      missing.push('fecha y hora de inicio')
    }

    if (appointmentDraft.location) {
      confirmed.push(`ubicación: ${appointmentDraft.location}`)
    } else {
      missing.push('ubicación')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0,
      intro: 'Identifiqué una nueva cita para agendar.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt: '¿Deseas agendar esta cita? Si confirmas, la crearé ahora.',
      pendingPrompt: 'Antes de seguir necesito completar esos datos.',
      execute: {
        type: 'single',
        toolName: 'create_appointment',
        payload: {
          title: appointmentDraft.title,
          startAt: appointmentDraft.startAt,
          location: appointmentDraft.location || undefined,
        },
        verifyEntity: 'appointment',
      },
      executionSuccessPrefix: 'Cita creada correctamente.',
      errorText:
        'La confirmación fue recibida, pero la creación de la cita falló. Revisa el payload y el error reportado abajo.',
      debugDetail:
        'Se extrajeron título, fecha/hora y ubicación desde el texto de entrada para una creación confirmable.',
    }
  }

  buildAppointmentUpdateDraft(actionIntent, input, operationalContext) {
    const explicitId = this.extractExplicitId(input, ['actividad', 'cita'])
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_appointments'),
      explicitId,
    )
    const appointmentDraft = this.extractAppointmentDraft(input)
    const changes = []
    const missing = []

    if (target) {
      changes.push(`actividad objetivo: #${target.id} ${target.title || 'sin título'}`)
    } else {
      missing.push('actividad objetivo')
    }
    if (appointmentDraft.title) {
      changes.push(`nuevo título: ${appointmentDraft.title}`)
    }
    if (appointmentDraft.startLabel) {
      changes.push(`nuevo inicio: ${appointmentDraft.startLabel}`)
    }
    if (appointmentDraft.location) {
      changes.push(`nueva ubicación: ${appointmentDraft.location}`)
    }

    const payload = {
      ...(appointmentDraft.title ? { title: appointmentDraft.title } : {}),
      ...(appointmentDraft.startAt ? { startAt: appointmentDraft.startAt } : {}),
      ...(appointmentDraft.location ? { location: appointmentDraft.location } : {}),
    }

    if (!Object.keys(payload).length) {
      missing.push('cambios a aplicar')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0,
      intro: 'He preparado la actualización de la cita.',
      sections: [
        { title: 'Confirmados', items: changes },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt: '¿Deseas aplicar estos cambios a la cita encontrada?',
      pendingPrompt: 'Antes de seguir necesito identificar la cita objetivo y los cambios a aplicar.',
      execute: {
        type: 'single',
        toolName: 'update_appointment',
        targetId: target?.id ?? null,
        payload,
        verifyEntity: 'appointment',
      },
      executionSuccessPrefix: 'Cita actualizada correctamente.',
      errorText:
        'La confirmación fue recibida, pero la actualización de la cita falló. Revisa el payload y el error reportado abajo.',
    }
  }

  buildAppointmentDeleteDraft(actionIntent, input, operationalContext) {
    const explicitId = this.extractExplicitId(input, ['actividad', 'cita'])
    const matchedTarget = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_appointments'),
      explicitId,
    )
    const target =
      matchedTarget ??
      (explicitId != null
        ? {
            id: explicitId,
            title: null,
          }
        : null)

    return {
      actionKey: actionIntent.key,
      ready: Boolean(target?.id),
      intro: 'He preparado la eliminación de la cita.',
      sections: [
        {
          title: 'Confirmados',
          items: target
            ? [`actividad objetivo: #${target.id} ${target.title || 'sin título'}`]
            : [],
        },
        {
          title: 'Faltantes',
          items: target ? [] : ['actividad objetivo'],
        },
      ],
      confirmationPrompt:
        '¿Deseas eliminar esta cita? Si confirmas, ejecutaré la eliminación y te devolveré el resultado.',
      pendingPrompt:
        'Antes de seguir necesito identificar con precisión la actividad a eliminar.',
      execute: {
        type: 'single',
        toolName: 'delete_appointment',
        targetId: target?.id ?? null,
        payload: {},
        verifyEntity: null,
      },
      executionSuccessPrefix: 'Cita eliminada correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude eliminar la cita. Revisa el error reportado abajo.',
      debugDetail:
        'Delete confirmable resuelto sobre actividad previamente encontrada por prebúsqueda.',
    }
  }

  buildCustomerCreateDraft(actionIntent, input) {
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:registrar|crear|alta de|nuevo|nueva)\s+(?:el\s+)?cliente\s+(.+?)(?=\s+(?:con|correo|mail|email|telefono|tel[eé]fono|tel|cel|whatsapp|direccion|dirección|ubicacion|ubicación)\b|$)/iu,
        /\bcliente\s+(.+?)(?=\s+(?:con|correo|mail|email|telefono|tel[eé]fono|tel|cel|whatsapp|direccion|dirección|ubicacion|ubicación)\b|$)/iu,
      ]) || null
    const email = this.extractEmailValue(input)
    const phoneNumber = this.extractPhoneValue(input)
    const location = this.extractLocationValue(input)

    const confirmed = []
    const missing = []
    const doubtful = []

    if (name) {
      confirmed.push(`nombre: ${name}`)
    } else {
      missing.push('nombre')
    }

    if (email) {
      confirmed.push(`email: ${email}`)
    } else if (/\b(?:correo|mail|email)\b/i.test(String(input || ''))) {
      doubtful.push('email')
    }

    if (phoneNumber) {
      confirmed.push(`teléfono: ${phoneNumber}`)
      const digits = phoneNumber.replace(/\D+/g, '')
      if (digits.length < 8) {
        doubtful.push('teléfono')
      }
    } else if (/\b(?:telefono|tel[eé]fono|tel|cel|whatsapp)\b/i.test(String(input || ''))) {
      doubtful.push('teléfono')
    }

    if (location) {
      confirmed.push(`ubicación: ${location}`)
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(location ? { location } : {}),
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro: 'He preparado el alta del cliente.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt: '¿Deseas registrar este cliente ahora?',
      pendingPrompt:
        'Antes de seguir necesito completar o corregir los datos faltantes o dudosos.',
      execute: {
        type: 'single',
        toolName: 'create_customer',
        payload,
        verifyEntity: 'customer',
      },
      executionSuccessPrefix: 'Cliente procesado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude registrar el cliente. Revisa el payload y el error reportado abajo.',
    }
  }

  buildCustomerUpdateDraft(actionIntent, input, operationalContext) {
    const explicitId = this.extractExplicitId(input, ['cliente'])
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_customers'),
      explicitId,
    )
    const email = this.extractEmailValue(input)
    const phoneNumber = this.extractPhoneValue(input)
    const location = this.extractLocationValue(input)
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:renombrar|cambiar nombre de|actualizar nombre de)\s+(?:cliente\s+)?(.+?)(?=\s+(?:a|por)\s+[a-záéíóúñ0-9 .'-]+$)/iu,
      ]) || null

    const confirmed = []
    const missing = []
    const doubtful = []

    if (target) {
      confirmed.push(`cliente objetivo: #${target.id} ${target.name}`)
    } else {
      missing.push('cliente objetivo')
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(location ? { location } : {}),
    }

    if (email) {
      confirmed.push(`email: ${email}`)
    } else if (/\b(?:correo|mail|email)\b/i.test(String(input || ''))) {
      doubtful.push('email')
    }
    if (phoneNumber) {
      confirmed.push(`teléfono: ${phoneNumber}`)
      const digits = phoneNumber.replace(/\D+/g, '')
      if (digits.length < 8) {
        doubtful.push('teléfono')
      }
    }
    if (location) {
      confirmed.push(`ubicación: ${location}`)
    }
    if (name) {
      confirmed.push(`nombre: ${name}`)
    }

    if (!Object.keys(payload).length) {
      missing.push('campos a modificar')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro: 'He preparado la actualización del cliente.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt: '¿Deseas aplicar estos cambios al cliente encontrado?',
      pendingPrompt:
        'Antes de seguir necesito identificar el cliente objetivo y corregir los datos dudosos o faltantes.',
      execute: {
        type: 'single',
        toolName: 'update_customer',
        targetId: target?.id ?? null,
        payload,
        verifyEntity: 'customer',
      },
      executionSuccessPrefix: 'Cliente actualizado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude actualizar el cliente. Revisa el payload y el error reportado abajo.',
    }
  }

  getRowCandidate(row, candidates = []) {
    if (!row || typeof row !== 'object') {
      return null
    }
    const entries = Object.entries(row)
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeText(candidate)
      const matched = entries.find(
        ([key]) => normalizeText(key) === normalizedCandidate,
      )
      if (matched && matched[1] != null && String(matched[1]).trim()) {
        return String(matched[1]).trim()
      }
    }
    return null
  }

  buildProductBatchDraft(actionIntent, extractedAssets = []) {
    const rows = extractedAssets
      .filter(
        (asset) => Array.isArray(asset?.structuredRows) && asset.structuredRows.length > 0,
      )
      .flatMap((asset) => asset.structuredRows)

    if (!rows.length) {
      return null
    }

    const readyItems = []
    const pendingItems = []

    rows.forEach((row, index) => {
      const name = this.getRowCandidate(row, ['name', 'nombre', 'producto', 'product'])
      const currency = this.getRowCandidate(row, ['currency', 'moneda'])
      const amountRaw = this.getRowCandidate(row, [
        'salePrice',
        'sale_price',
        'precio',
        'price',
      ])
      const stockRaw = this.getRowCandidate(row, ['stock', 'existencias'])
      const productCode = this.getRowCandidate(row, [
        'productCode',
        'product_code',
        'codigo',
        'código',
        'code',
      ])

      const salePrice =
        amountRaw != null && amountRaw !== ''
          ? Number(String(amountRaw).replace(',', '.'))
          : null
      const stock =
        stockRaw != null && stockRaw !== ''
          ? Number.parseInt(String(stockRaw), 10)
          : null
      const missing = []
      if (!name) missing.push('name')
      if (salePrice != null && !currency) missing.push('currency')
      if (amountRaw != null && (salePrice == null || Number.isNaN(salePrice))) {
        missing.push('salePrice')
      }

      const payload = {
        ...(name ? { name } : {}),
        ...(productCode ? { productCode } : {}),
        ...(salePrice != null && Number.isFinite(salePrice) ? { salePrice } : {}),
        ...(currency ? { currency } : {}),
        ...(stock != null && Number.isFinite(stock) ? { stock } : {}),
      }

      const summary = `${index + 1}. ${name || 'sin nombre'}${
        currency && salePrice != null ? ` ${currency} ${salePrice}` : ''
      }${stock != null && Number.isFinite(stock) ? ` stock:${stock}` : ''}`.trim()

      if (!missing.length) {
        readyItems.push({
          summary,
          payload,
        })
      } else {
        pendingItems.push({
          summary,
          missing,
        })
      }
    })

    if (!readyItems.length && !pendingItems.length) {
      return null
    }

    return {
      actionKey: actionIntent.key,
      ready: readyItems.length > 0,
      intro: 'He preparado el alta en lote de productos desde los datos tabulares detectados.',
      sections: [
        {
          title: 'Listos para alta',
          items: readyItems.map((item) => item.summary),
        },
        {
          title: 'Pendientes',
          items: pendingItems.map(
            (item) => `${item.summary}: falta ${item.missing.join(', ')}`,
          ),
        },
      ],
      confirmationPrompt:
        '¿Deseas crear los productos válidos detectados en el lote? Si confirmas, los crearé ahora y devolveré enlaces de verificación.',
      pendingPrompt:
        'Todavía no hay filas válidas suficientes para ejecutar el alta en lote.',
      execute: {
        type: 'batch',
        items: readyItems.map((item) => ({
          toolName: 'create_product',
          payload: item.payload,
          verifyEntity: 'product',
          successLabel: item.payload.name,
        })),
      },
      batchSuccessTitle: 'Productos creados correctamente desde el lote:',
      debugDetail:
        'Se usaron filas tabulares extraídas desde CSV/XLSX para construir un draft batch de productos.',
    }
  }

  buildProductCreateDraft(actionIntent, input) {
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:crear|nuevo|alta de)\s+producto\s+(.+?)(?=\s+(?:con|precio|stock|codigo|c[oó]digo|descripci[oó]n|moneda|currency|publicado|publicar)\b|$)/iu,
        /\bproducto\s+(.+?)(?=\s+(?:con|precio|stock|codigo|c[oó]digo|descripci[oó]n|moneda|currency|publicado|publicar)\b|$)/iu,
      ]) || null
    const { currency, amount } = this.extractCurrencyAmount(input)
    const stock = this.extractIntegerValue(String(input || ''), [
      /\bstock\s*(?:de|en)?\s*(\d+)\b/iu,
    ])
    const productCode =
      extractNamedEntity(String(input || ''), [/\b(?:codigo|c[oó]digo)\s*(?:es|:)?\s*([a-z0-9-]+)\b/iu]) ||
      null

    const confirmed = []
    const missing = []
    const doubtful = []

    if (name) {
      confirmed.push(`nombre: ${name}`)
    } else {
      missing.push('nombre')
    }
    if (amount != null) {
      confirmed.push(`precio: ${amount}`)
      if (!currency) {
        doubtful.push('moneda')
      }
    } else if (/\bprecio\b/i.test(String(input || ''))) {
      missing.push('precio')
    }
    if (currency) {
      confirmed.push(`moneda: ${currency}`)
    }
    if (stock != null) {
      confirmed.push(`stock: ${stock}`)
    }
    if (productCode) {
      confirmed.push(`código: ${productCode}`)
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(productCode ? { productCode } : {}),
      ...(amount != null ? { salePrice: amount } : {}),
      ...(currency ? { currency } : {}),
      ...(stock != null ? { stock } : {}),
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro: 'He preparado el alta del producto.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt: '¿Deseas crear este producto ahora?',
      pendingPrompt:
        'Antes de seguir necesito completar o corregir precio, moneda o nombre del producto.',
      execute: {
        type: 'single',
        toolName: 'create_product',
        payload,
        verifyEntity: 'product',
      },
      executionSuccessPrefix: 'Producto creado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude crear el producto. Revisa el payload y el error reportado abajo.',
    }
  }

  buildProductUpdateDraft(actionIntent, input, operationalContext) {
    const explicitId = this.extractExplicitId(input, ['producto'])
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_products'),
      explicitId,
    )
    const { currency, amount } = this.extractCurrencyAmount(input)
    const stock = this.extractIntegerValue(String(input || ''), [
      /\bstock\s*(?:de|en)?\s*(\d+)\b/iu,
    ])
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:renombrar|cambiar nombre de|actualizar nombre de)\s+(?:producto\s+)?(.+?)(?=\s+(?:a|por)\s+[a-záéíóúñ0-9 .'-]+$)/iu,
      ]) || null

    const confirmed = []
    const missing = []
    const doubtful = []

    if (target) {
      confirmed.push(`producto objetivo: #${target.id} ${target.name}`)
    } else {
      missing.push('producto objetivo')
    }

    if (amount != null) {
      confirmed.push(`precio: ${amount}`)
      if (!currency) {
        doubtful.push('moneda')
      }
    }
    if (currency) {
      confirmed.push(`moneda: ${currency}`)
    }
    if (stock != null) {
      confirmed.push(`stock: ${stock}`)
    }
    if (name) {
      confirmed.push(`nombre: ${name}`)
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(amount != null ? { salePrice: amount } : {}),
      ...(currency ? { currency } : {}),
      ...(stock != null ? { stock } : {}),
    }

    if (!Object.keys(payload).length) {
      missing.push('campos a modificar')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro: 'He preparado la actualización del producto.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt: '¿Deseas aplicar estos cambios al producto encontrado?',
      pendingPrompt:
        'Antes de seguir necesito identificar el producto objetivo y corregir los datos faltantes o dudosos.',
      execute: {
        type: 'single',
        toolName: 'update_product',
        targetId: target?.id ?? null,
        payload,
        verifyEntity: 'product',
      },
      executionSuccessPrefix: 'Producto actualizado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude actualizar el producto. Revisa el payload y el error reportado abajo.',
    }
  }

  buildDocumentActionDraft(actionIntent, input, operationalContext) {
    const toolNameByAction = {
      'orders.update_status': 'search_orders',
      'orders.update_comment': 'search_orders',
      'quotes.update_status': 'search_quotes',
      'quotes.update_comment': 'search_quotes',
      'quotes.send': 'search_quotes',
      'quotes.confirm': 'search_quotes',
      'payments.update_status': 'search_payments',
      'payments.update': 'search_payments',
    }

    const entityByAction = {
      'orders.update_status': 'order',
      'orders.update_comment': 'order',
      'quotes.update_status': 'quote',
      'quotes.update_comment': 'quote',
      'quotes.send': 'quote',
      'quotes.confirm': 'quote',
      'payments.update_status': 'payment',
      'payments.update': 'payment',
    }

    const toolName = toolNameByAction[actionIntent.key]
    const entity = entityByAction[actionIntent.key]
    const explicitId = this.extractExplicitId(
      input,
      entity === 'order'
        ? ['pedido']
        : entity === 'quote'
          ? ['presupuesto']
          : ['pago'],
    )
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, toolName),
      explicitId,
    )

    const confirmed = []
    const missing = []
    let payload = {}
    let toolNameToExecute = null
    let verifyEntity = entity
    let intro = 'He preparado la operación solicitada.'
    let confirmationPrompt = '¿Deseas confirmar esta operación?'
    let successPrefix = 'Operación ejecutada correctamente.'
    let errorText =
      'La confirmación fue recibida, pero no pude completar la operación. Revisa el error reportado abajo.'

    if (target) {
      const targetLabel =
        entity === 'payment'
          ? `pago objetivo: #${target.id}${target.reference ? ` (${target.reference})` : ''}`
          : `${entity === 'quote' ? 'presupuesto' : 'pedido'} objetivo: #${target.id}${target.uuid ? ` (${target.uuid})` : ''}`
      confirmed.push(targetLabel)
    } else {
      missing.push(`${entity === 'quote' ? 'presupuesto' : entity === 'order' ? 'pedido' : 'pago'} objetivo`)
    }

    if (actionIntent.key === 'orders.update_status' || actionIntent.key === 'quotes.update_status' || actionIntent.key === 'payments.update_status') {
      const status = this.extractStatusValue(actionIntent.key, input)
      if (status) {
        confirmed.push(`nuevo estado: ${status}`)
        payload = { status }
      } else {
        missing.push('nuevo estado')
      }
      toolNameToExecute =
        actionIntent.key === 'orders.update_status'
          ? 'update_order_status'
          : actionIntent.key === 'quotes.update_status'
            ? 'update_quote_status'
            : 'update_payment_status'
      intro =
        actionIntent.key === 'payments.update_status'
          ? 'He preparado el cambio de estado del pago.'
          : `He preparado el cambio de estado del ${entity === 'quote' ? 'presupuesto' : 'pedido'}.`
      confirmationPrompt =
        actionIntent.key === 'payments.update_status'
          ? '¿Deseas aplicar este cambio de estado al pago encontrado?'
          : `¿Deseas aplicar este cambio de estado al ${entity === 'quote' ? 'presupuesto' : 'pedido'} encontrado?`
      successPrefix =
        actionIntent.key === 'payments.update_status'
          ? 'Pago actualizado correctamente.'
          : `${entity === 'quote' ? 'Presupuesto' : 'Pedido'} actualizado correctamente.`
    } else if (actionIntent.key === 'orders.update_comment' || actionIntent.key === 'quotes.update_comment') {
      const comment = this.extractCommentValue(input)
      if (comment) {
        confirmed.push(`comentario: ${comment}`)
        payload = { comment }
      } else {
        missing.push('comentario')
      }
      toolNameToExecute =
        actionIntent.key === 'orders.update_comment'
          ? 'update_order_comment'
          : 'update_quote_comment'
      intro = `He preparado la actualización del comentario del ${entity === 'quote' ? 'presupuesto' : 'pedido'}.`
      confirmationPrompt = `¿Deseas aplicar este comentario al ${entity === 'quote' ? 'presupuesto' : 'pedido'} encontrado?`
      successPrefix = `${entity === 'quote' ? 'Presupuesto' : 'Pedido'} actualizado correctamente.`
    } else if (actionIntent.key === 'quotes.send') {
      toolNameToExecute = 'send_quote'
      intro = 'He preparado el envío del presupuesto.'
      confirmationPrompt = '¿Deseas marcar como enviado el presupuesto encontrado?'
      successPrefix = 'Presupuesto enviado correctamente.'
    } else if (actionIntent.key === 'quotes.confirm') {
      toolNameToExecute = 'confirm_quote'
      intro = 'He preparado la confirmación del presupuesto.'
      confirmationPrompt = '¿Deseas confirmar el presupuesto encontrado y convertirlo según el flujo real?'
      successPrefix = 'Presupuesto confirmado correctamente.'
      verifyEntity = 'order'
    } else if (actionIntent.key === 'payments.update') {
      const method =
        extractNamedEntity(String(input || ''), [/\b(?:m[eé]todo|metodo)\s*(?:es|:)?\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:referencia|nota|notas)\b|$)/iu]) ||
        null
      const reference =
        extractNamedEntity(String(input || ''), [/\breferencia\s*(?:es|:)?\s+([a-záéíóúñ0-9 .'-]+)$/iu]) ||
        null
      const notes =
        extractNamedEntity(String(input || ''), [/\bnota[s]?\s*(?:es|:)?\s+(.+)$/iu]) ||
        null

      payload = {
        ...(method ? { method } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
      }

      if (method) confirmed.push(`método: ${method}`)
      if (reference) confirmed.push(`referencia: ${reference}`)
      if (notes) confirmed.push(`nota: ${notes}`)
      if (!Object.keys(payload).length) {
        missing.push('campos a modificar')
      }

      toolNameToExecute = 'update_payment'
      intro = 'He preparado la actualización del pago.'
      confirmationPrompt = '¿Deseas aplicar estos cambios al pago encontrado?'
      successPrefix = 'Pago actualizado correctamente.'
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0,
      intro,
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt,
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente la entidad objetivo y completar los datos faltantes.',
      execute: {
        type: 'single',
        toolName: toolNameToExecute,
        targetId: target?.id ?? null,
        payload,
        verifyEntity,
      },
      executionSuccessPrefix: successPrefix,
      errorText,
    }
  }

  async buildDeterministicOperationalResponse({
    role,
    input,
    actionIntent,
    actionCatalog,
    operationalContext,
    extractedAssets,
    requestedToolRequiresConfirmation,
    backendClient,
  }) {
    if (!(role.startsWith('admin_') || role === 'superadmin') || !actionIntent) {
      return null
    }
    const requiresConfirmationFlow =
      requestedToolRequiresConfirmation || actionIntent.key === 'aberturas.register'
    if (!requiresConfirmationFlow) {
      return null
    }

    let draft = this.buildOperationDraft(
      actionIntent,
      input,
      operationalContext,
      extractedAssets,
    )
    const refined = await this.maybeRefineDraftWithStructuredExtraction({
      role,
      actionIntent,
      actionCatalog,
      input,
      extractedAssets,
      operationalContext,
      draft,
      backendClient,
    })
    draft = refined.draft
    const response = this.buildOperationDraftResponse(actionIntent, draft)
    if (!response) {
      return null
    }
    return {
      response,
      operationalContext: refined.operationalContext,
    }
  }

  extractAppointmentDraft(input) {
    const title =
      extractNamedEntity(input, [
        /\btitulad[ao]\s+(.+?)(?=\s+para\s+(?:el\s+)?\d{1,2}\/\d{1,2}\/\d{4}\s+a\s+las\s+\d{1,2}:\d{2}|\s+en\s+|$)/iu,
        /\bcita\s+(.+?)(?=\s+para\s+(?:el\s+)?\d{1,2}\/\d{1,2}\/\d{4}\s+a\s+las\s+\d{1,2}:\d{2}|\s+en\s+|$)/iu,
      ]) || null

    const scheduleMatch = String(input || '').match(
      /\b(?:para\s+el|el)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+a\s+las\s+(\d{1,2}:\d{2})/iu,
    )
    const startLabel = scheduleMatch
      ? `${scheduleMatch[1]} ${scheduleMatch[2]}`
      : null

    const location =
      extractNamedEntity(input, [/\ben\s+([a-záéíóúñ0-9 .,'/-]+)$/iu]) || null

    const startAt = scheduleMatch
      ? this.parseAppointmentDateToIso(scheduleMatch[1], scheduleMatch[2])
      : null

    return {
      title,
      startLabel,
      startAt,
      location,
    }
  }

  parseAppointmentDateToIso(datePart, timePart) {
    const match = String(datePart || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!match) {
      return null
    }
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00.000Z`
  }

  appendAdminDebugSummary(response, context) {
    if (
      !isDebugModeEnabled() ||
      !(context?.role?.startsWith('admin_') || context?.role === 'superadmin') ||
      !response ||
      typeof response.text !== 'string'
    ) {
      return response
    }

    const toolLines = Array.isArray(context.toolCalls)
      ? context.toolCalls.map((entry) => {
          const target =
            entry?.arguments?.query ??
            entry?.arguments?.text ??
            entry?.arguments?.id ??
            null
          return `${entry?.name || 'tool'}:${entry?.status || 'unknown'}${target ? `(${String(target).slice(0, 120)})` : ''}`
        })
      : []

    const debugLines = [
      '[debug]',
      `etapa=${context.stage || 'unknown'}`,
      `intent=${context.intentKey || 'n/a'}`,
      `accion=${context.actionKey || 'n/a'}`,
      `input=${String(context.input || '').slice(0, 240)}`,
    ]

    if (Array.isArray(context.blockedTools) && context.blockedTools.length) {
      debugLines.push(`tools_bloqueadas=${context.blockedTools.join(',')}`)
    }
    if (toolLines.length) {
      debugLines.push(`tools=${toolLines.join(' | ')}`)
    }
    if (Array.isArray(context.referencedMessages) && context.referencedMessages.length) {
      debugLines.push(
        `referencias=${context.referencedMessages
          .map(
            (item) =>
              item?.messageId ||
              item?.createdAt ||
              String(item?.preview || '').slice(0, 40) ||
              'mensaje_reciente',
          )
          .join(' | ')}`,
      )
    }
    if (context.detail) {
      debugLines.push(`detalle=${context.detail}`)
    }

    return {
      ...response,
      text: `${response.text}\n\n${debugLines.join('\n')}`,
    }
  }

  buildCustomerSearchFallbackResponse({
    role,
    intentKey,
    operationalContext,
    fallbackReason,
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      !(intentKey === 'customer.quote' || intentKey === 'customer.product_info')
    ) {
      return null
    }

    const matches = this.getExecutedToolResult(
      operationalContext?.toolCalls,
      'search_products',
    )
    if (!Array.isArray(matches)) {
      return null
    }

    const firstMatch = matches[0] ?? null
    if (!firstMatch) {
      return {
        text:
          'No encontré un producto publicado que coincida exactamente con esa configuración. Un asesor del equipo te indicará cómo continuar y te ayudará a confirmar alternativas, medidas y disponibilidad.',
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
          fallbackReason,
        },
      }
    }

    const amount =
      typeof firstMatch.amount === 'number' && Number.isFinite(firstMatch.amount)
        ? firstMatch.amount
        : null
    const currency =
      typeof firstMatch.currency === 'string' && firstMatch.currency.trim()
        ? firstMatch.currency.trim().toUpperCase()
        : null
    const productName = String(firstMatch.name || 'el producto consultado').trim()

    const lines = [
      `Encontré una coincidencia publicada para tu consulta: ${productName}.`,
    ]

    if (amount != null && currency) {
      lines.push(`Precio de referencia: ${currency} ${amount}.`)
    } else {
      lines.push(
        'En este momento no pude confirmar el precio exacto, pero un asesor puede ayudarte a validarlo.',
      )
    }

    if (intentKey === 'customer.quote') {
      lines.push(
        'Si quieres, un asesor puede continuar contigo para confirmar medidas, vidrio y disponibilidad antes de cerrar la cotización.',
      )
    } else {
      lines.push(
        'Si necesitas más detalle o una cotización, un asesor puede continuar contigo y ayudarte con el siguiente paso.',
      )
    }

    return {
      text: lines.join(' '),
      toolCalls: [],
      needsHuman: false,
      grounding: {
        grounded: true,
        fallbackReason,
      },
    }
  }

  getExecutedToolResult(toolCalls, toolName) {
    return (
      (Array.isArray(toolCalls)
        ? toolCalls.find(
            (entry) => entry?.name === toolName && entry?.status === 'executed',
          )?.result
        : null) ?? null
    )
  }

  extractExplicitId(input, labels = []) {
    const normalizedLabels = Array.isArray(labels) ? labels : [labels]
    for (const label of normalizedLabels) {
      const match = String(input || '').match(
        new RegExp(`\\b${label}\\s+#?(\\d+)\\b`, 'iu'),
      )
      if (match?.[1]) {
        return Number(match[1])
      }
    }
    return null
  }

  selectEntityMatch(results, explicitId = null) {
    if (!Array.isArray(results) || !results.length) {
      return null
    }
    if (explicitId != null) {
      return results.find((item) => Number(item?.id) === Number(explicitId)) ?? null
    }
    return results[0] ?? null
  }

  extractEmailValue(input) {
    const match = String(input || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/iu)
    return match?.[0]?.trim().toLowerCase() ?? null
  }

  extractPhoneValue(input) {
    const labeled =
      extractNamedEntity(String(input || ''), [
        /\b(?:telefono|tel[eé]fono|tel|cel|celular|whatsapp|wpp)\s*(?:es|:)?\s*([+()0-9 \-]{6,})/iu,
      ]) ?? null
    const raw =
      labeled ??
      extractNamedEntity(String(input || ''), [
        /\b(\+?\d[\d ()-]{6,}\d)\b/u,
      ])

    if (!raw) {
      return null
    }

    const cleaned = raw.replace(/[^\d+]/g, '')
    return cleaned.length >= 7 ? cleaned : null
  }

  extractCurrencyAmount(input) {
    const text = String(input || '')
    const direct = text.match(/\b(usd|uyu|eur)\s*([0-9]+(?:[.,][0-9]{1,2})?)\b/iu)
    if (direct) {
      return {
        currency: direct[1].toUpperCase(),
        amount: Number(direct[2].replace(',', '.')),
      }
    }

    const reverse = text.match(/\b([0-9]+(?:[.,][0-9]{1,2})?)\s*(usd|uyu|eur)\b/iu)
    if (reverse) {
      return {
        currency: reverse[2].toUpperCase(),
        amount: Number(reverse[1].replace(',', '.')),
      }
    }

    return { currency: null, amount: null }
  }

  extractIntegerValue(input, patterns = []) {
    for (const pattern of patterns) {
      const match = String(input || '').match(pattern)
      if (match?.[1]) {
        return Number(match[1])
      }
    }
    return null
  }

  extractCommentValue(input) {
    return (
      extractNamedEntity(String(input || ''), [
        /\b(?:comentario|nota)\s+(?:del|de la|para el|para la)?\s*(?:pedido|presupuesto|pago)?\s*(?:indicando|que|:)?\s+(.+)$/iu,
        /\bindicando\s+(.+)$/iu,
      ]) ?? null
    )
  }

  extractLocationValue(input) {
    return (
      extractNamedEntity(String(input || ''), [
        /\b(?:direccion|dirección|ubicacion|ubicación)\s*(?:es|:)?\s+(.+?)(?=\s+(?:correo|mail|email|telefono|tel[eé]fono|tel|cel|whatsapp)\b|$)/iu,
        /\ben\s+([a-záéíóúñ0-9 .,'/-]+)$/iu,
      ]) ?? null
    )
  }

  extractStatusValue(actionKey, input) {
    const normalized = normalizeText(input)

    if (actionKey === 'orders.update_status') {
      if (/\bpendiente\b/.test(normalized)) return 'pending'
      if (/\bpago|pagado\b/.test(normalized)) return 'paid'
      if (/\bcancelado|cancelar\b/.test(normalized)) return 'cancelled'
      if (/\bentregado|entregar\b/.test(normalized)) return 'delivered'
      return null
    }

    if (actionKey === 'quotes.update_status') {
      if (/\bborrador|draft\b/.test(normalized)) return 'budget_draft'
      if (/\benviado|enviar\b/.test(normalized)) return 'budget_sent'
      if (/\baceptado|aceptar\b/.test(normalized)) return 'budget_accepted'
      if (/\bconvertido|convertir\b/.test(normalized)) return 'budget_converted'
      if (/\bcancelado|cancelar\b/.test(normalized)) return 'budget_cancelled'
      if (/\bvencido|expirado|expirar\b/.test(normalized)) return 'budget_expired'
      return null
    }

    if (actionKey === 'payments.update_status') {
      if (/\bconfirmado|confirmar\b/.test(normalized)) return 'CONFIRMED'
      if (/\bregistrado|registrar\b/.test(normalized)) return 'REGISTERED'
      if (/\bfallido|rechazado|fallar\b/.test(normalized)) return 'FAILED'
      return null
    }

    return null
  }

  buildOperationDraftToolCall(actionIntent, draft) {
    return {
      name: OPERATION_DRAFT_TOOL_NAME,
      status: 'draft',
      arguments: {
        actionKey: actionIntent.key,
      },
      result: {
        actionKey: actionIntent.key,
        draft,
      },
    }
  }

  buildOperationDraftResponse(actionIntent, draft) {
    if (!draft) {
      return null
    }

    const lines = [draft.intro]
    for (const section of draft.sections ?? []) {
      if (!Array.isArray(section?.items) || section.items.length === 0) {
        continue
      }
      lines.push('', section.title + ':', ...section.items.map((item) => `- ${item}`))
    }

    if (draft.ready) {
      lines.push('', draft.confirmationPrompt || actionIntent.confirmationPrompt || '¿Deseas confirmar esta operación?')
    } else {
      lines.push(
        '',
        draft.pendingPrompt || 'Antes de seguir necesito completar o corregir los datos faltantes.',
      )
    }

    return {
      text: lines.join('\n'),
      toolCalls: [this.buildOperationDraftToolCall(actionIntent, draft)],
      needsHuman: false,
      grounding: {
        grounded: false,
        fallbackReason: draft.ready ? 'requires_confirmation' : 'pending_required_fields',
      },
      debug: {
        actionKey: actionIntent.key,
        detail:
          draft.debugDetail ||
          'Se preparó un draft operativo confirmable antes de ejecutar la acción real.',
      },
    }
  }

  buildVerificationLink(entity, result) {
    const builder = VERIFICATION_ROUTE_BUILDERS[entity]
    if (!builder) {
      return null
    }

    let id = null
    if (entity === 'customer') {
      id = result?.customer?.id ?? result?.id ?? null
    } else if (entity === 'order') {
      id = result?.convertedOrderId ?? result?.id ?? null
    } else {
      id = result?.id ?? null
    }

    return id != null ? builder(id) : null
  }

  async executeOperationDraft(draft, backendClient) {
    if (!draft?.execute) {
      return { executions: [], detail: 'No se encontró metadata de ejecución en el draft.' }
    }

    const executeSingle = async (step) => {
      const execution = {
        name: step.toolName,
        arguments:
          step.targetId != null
            ? { id: step.targetId, ...(step.payload ?? {}) }
            : { ...(step.payload ?? {}) },
      }

      try {
        let result = null
        switch (step.toolName) {
          case 'create_customer':
            result = await backendClient.createCustomer(step.payload)
            break
          case 'update_customer':
            result = await backendClient.updateCustomer(step.targetId, step.payload)
            break
          case 'create_product':
            result = await backendClient.createProduct(step.payload)
            break
          case 'update_product':
            result = await backendClient.updateProduct(step.targetId, step.payload)
            break
          case 'create_appointment':
            result = await backendClient.createAppointment(step.payload)
            break
          case 'update_appointment':
            result = await backendClient.updateAppointment(step.targetId, step.payload)
            break
          case 'delete_appointment':
            result = await backendClient.deleteAppointment(step.targetId)
            break
          case 'update_order_status':
            result = await backendClient.updateOrderStatus(step.targetId, step.payload)
            break
          case 'update_order_comment':
            result = await backendClient.updateOrderComment(step.targetId, step.payload)
            break
          case 'update_quote_status':
            result = await backendClient.updateQuoteStatus(step.targetId, step.payload)
            break
          case 'update_quote_comment':
            result = await backendClient.updateQuoteComment(step.targetId, step.payload)
            break
          case 'send_quote':
            result = await backendClient.sendQuote(step.targetId)
            break
          case 'confirm_quote':
            result = await backendClient.confirmQuote(step.targetId)
            break
          case 'update_payment_status':
            result = await backendClient.updatePaymentStatus(step.targetId, step.payload)
            break
          case 'update_payment':
            result = await backendClient.updatePayment(step.targetId, step.payload)
            break
          default:
            throw new Error(`unsupported tool ${step.toolName}`)
        }

        return {
          ...execution,
          result,
          status: 'executed',
          verifyEntity: step.verifyEntity ?? null,
          successLabel: step.successLabel ?? null,
        }
      } catch (error) {
        return {
          ...execution,
          result: null,
          status: 'failed',
          verifyEntity: step.verifyEntity ?? null,
          successLabel: step.successLabel ?? null,
          errorMessage: error instanceof Error ? error.message : `${step.toolName} failed`,
        }
      }
    }

    if (draft.execute.type === 'batch') {
      const executions = []
      for (const step of draft.execute.items ?? []) {
        executions.push(await executeSingle(step))
      }
      return {
        executions,
        detail: `Ejecución batch completada. Ejecutados: ${executions.filter((entry) => entry.status === 'executed').length}. Fallidos: ${executions.filter((entry) => entry.status === 'failed').length}.`,
      }
    }

    const execution = await executeSingle(draft.execute)
    return {
      executions: [execution],
      detail:
        execution.status === 'executed'
          ? `Se ejecutó ${execution.name} correctamente.`
          : execution.errorMessage || `Falló ${execution.name}.`,
    }
  }

  formatExecutionResponse(draft, executions = []) {
    const success = executions.filter((entry) => entry.status === 'executed')
    const failed = executions.filter((entry) => entry.status === 'failed')

    if (draft?.execute?.type === 'batch') {
      const lines = []
      if (success.length) {
        lines.push(draft.batchSuccessTitle || 'Operación ejecutada correctamente para los siguientes elementos:')
        for (const entry of success) {
          const link = this.buildVerificationLink(entry.verifyEntity, entry.result)
          lines.push(
            `- ${entry.successLabel || entry.result?.name || entry.arguments?.name || 'Elemento'}${link ? ` · detalle: ${link}` : ''}`,
          )
        }
      }
      if (failed.length) {
        lines.push(...(lines.length ? ['', 'Fallos:'] : ['Fallos:']))
        for (const entry of failed) {
          lines.push(
            `- ${entry.successLabel || entry.arguments?.name || 'Elemento'}: ${entry.errorMessage || 'error desconocido'}`,
          )
        }
      }
      return {
        text: lines.join('\n'),
        needsHuman: failed.length > 0,
        grounding: {
          grounded: false,
          fallbackReason: failed.length > 0 ? 'execution_partial_failure' : null,
        },
      }
    }

    const [entry] = executions
    if (!entry) {
      return {
        text: 'No se encontró una ejecución válida para completar esta operación.',
        needsHuman: true,
        grounding: { grounded: false, fallbackReason: 'execution_failed' },
      }
    }

    if (entry.status === 'failed') {
      return {
        text:
          draft.errorText ||
          `La operación no pudo completarse. Error: ${entry.errorMessage || 'error desconocido'}.`,
        needsHuman: true,
        grounding: { grounded: false, fallbackReason: 'execution_failed' },
      }
    }

    const link = this.buildVerificationLink(entry.verifyEntity, entry.result)
    const successText =
      draft.successText ||
      `${draft.executionSuccessPrefix || 'Operación ejecutada correctamente.'}${link ? ` Verificación: ${link}` : ''}`

    return {
      text: successText,
      needsHuman: false,
      grounding: { grounded: false, fallbackReason: null },
    }
  }

  buildOperationDraft(
    actionIntent,
    input,
    operationalContext,
    extractedAssets = [],
  ) {
    switch (actionIntent?.key) {
      case 'aberturas.register':
        return this.buildAberturasRegisterDraft(actionIntent, operationalContext)
      case 'appointments.create':
        return this.buildAppointmentCreateDraft(actionIntent, input)
      case 'appointments.update':
        return this.buildAppointmentUpdateDraft(actionIntent, input, operationalContext)
      case 'appointments.delete':
        return this.buildAppointmentDeleteDraft(actionIntent, input, operationalContext)
      case 'customers.create':
        return this.buildCustomerCreateDraft(actionIntent, input)
      case 'customers.update':
        return this.buildCustomerUpdateDraft(actionIntent, input, operationalContext)
      case 'products.create':
        return (
          this.buildProductBatchDraft(actionIntent, extractedAssets) ||
          this.buildProductCreateDraft(actionIntent, input)
        )
      case 'products.update':
        return this.buildProductUpdateDraft(actionIntent, input, operationalContext)
      case 'orders.update_status':
      case 'orders.update_comment':
      case 'quotes.update_status':
      case 'quotes.update_comment':
      case 'quotes.send':
      case 'quotes.confirm':
      case 'payments.update_status':
      case 'payments.update':
        return this.buildDocumentActionDraft(actionIntent, input, operationalContext)
      default:
        return null
    }
  }

  async tryExecutePendingConfirmation({
    snapshot,
    taskMemory,
    conversationId,
    role,
    scope,
    input,
    backendClient,
  }) {
    if (
      !(role.startsWith('admin_') || role === 'superadmin') ||
      !hasExplicitConfirmation(input)
    ) {
      return null
    }

    const pendingTaskId = snapshot?.taskState?.taskId ?? taskMemory.taskId
    const pendingIntentKey = snapshot?.taskState?.intentKey ?? taskMemory.intentKey

    const agentToolTurns = [...(snapshot?.turns ?? [])]
      .reverse()
      .filter(
        (turn) =>
          turn?.role === 'agent' &&
          Array.isArray(turn?.metadata?.toolCalls),
      )
    const lastToolCarrier =
      agentToolTurns.find((turn) => turn?.metadata?.taskId === pendingTaskId) ??
      agentToolTurns[0] ??
      null

    const toolCalls = Array.isArray(lastToolCarrier?.metadata?.toolCalls)
      ? lastToolCarrier.metadata.toolCalls
      : []

    const operationDraft =
      toolCalls.find(
        (entry) =>
          entry?.name === OPERATION_DRAFT_TOOL_NAME &&
          entry?.status === 'draft' &&
          entry?.result?.actionKey === pendingIntentKey &&
          entry?.result?.draft,
      )?.result?.draft ?? null

    if (operationDraft) {
      const { executions, detail } = await this.executeOperationDraft(
        operationDraft,
        backendClient,
      )
      const response = this.formatExecutionResponse(operationDraft, executions)

      return {
        ...response,
        toolCalls: executions,
        debug: {
          actionKey: `${pendingIntentKey}.confirm`,
          detail,
        },
      }
    }

    const insertDraft = toolCalls.find(
      (entry) =>
        entry?.name === 'prepare_aberturas_insert' &&
        entry?.status === 'executed' &&
        entry?.result?.itemCount,
    )?.result

    if (pendingIntentKey === 'aberturas.register' && insertDraft) {
      const readyItems = Array.isArray(insertDraft.items)
        ? insertDraft.items.filter((item) => item?.validForInsert && item?.insertPayload)
        : []
      if (!readyItems.length) {
        return {
          text:
            'No hay ítems válidos para crear todavía. Corrige los faltantes detectados y vuelve a confirmar.',
          toolCalls: [],
          needsHuman: false,
          grounding: { grounded: false, fallbackReason: 'pending_required_fields' },
          debug: {
            actionKey: 'aberturas.register.confirm',
            detail: 'La confirmación llegó, pero el draft no contiene insertPayloads válidos.',
          },
        }
      }

      const executions = []
      for (const item of readyItems) {
        try {
          const created = await backendClient.createProduct(item.insertPayload)
          executions.push({
            name: 'create_product',
            arguments: item.insertPayload,
            result: created,
            status: 'executed',
          })
        } catch (error) {
          executions.push({
            name: 'create_product',
            arguments: item.insertPayload,
            result: null,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'create_product failed',
          })
        }
      }

      const success = executions.filter((entry) => entry.status === 'executed')
      const failed = executions.filter((entry) => entry.status === 'failed')
      const lines = []
      if (success.length) {
        lines.push('Alta ejecutada correctamente para los siguientes productos:')
        for (const entry of success) {
          lines.push(
            `- ${entry.result?.name || entry.arguments?.name || 'Producto'} · detalle: /app/products/edit/${entry.result?.id}`,
          )
        }
      }
      if (failed.length) {
        lines.push('', 'Fallos de creación:')
        for (const entry of failed) {
          lines.push(
            `- ${entry.arguments?.name || 'Producto'}: ${entry.errorMessage || 'error desconocido'}`,
          )
        }
      }

      return {
        text: lines.join('\n'),
        toolCalls: executions,
        needsHuman: failed.length > 0,
        grounding: {
          grounded: false,
          fallbackReason: failed.length > 0 ? 'execution_partial_failure' : null,
        },
        debug: {
          actionKey: 'aberturas.register.confirm',
          detail: `Se confirmó el draft de alta. Productos creados: ${success.length}. Fallidos: ${failed.length}.`,
        },
      }
    }

    const customerTurns = [...(snapshot?.turns ?? [])]
      .reverse()
      .filter(
        (turn) =>
          turn?.role === 'customer' &&
          turn?.text &&
          !hasExplicitConfirmation(turn.text),
      )
    const lastCustomerText =
      customerTurns.find((turn) => turn?.metadata?.taskId === pendingTaskId)
        ?.text ??
      customerTurns[0]?.text ??
      null

    if (pendingIntentKey === 'appointments.create' && lastCustomerText) {
      const draft = this.extractAppointmentDraft(lastCustomerText)
      if (!draft.title || !draft.startAt) {
        return {
          text:
            'No pude confirmar la creación porque faltan datos estructurales de la cita. Revisa título, fecha y hora.',
          toolCalls: [],
          needsHuman: false,
          grounding: { grounded: false, fallbackReason: 'pending_required_fields' },
          debug: {
            actionKey: 'appointments.create.confirm',
            detail: 'La confirmación llegó, pero no se pudo reconstruir un payload válido de la cita.',
          },
        }
      }

      try {
        const created = await backendClient.createAppointment({
          title: draft.title,
          startAt: draft.startAt,
          location: draft.location || undefined,
        })
        return {
          text: `Cita creada correctamente: ${created.title} · detalle operativo: actividad #${created.id}.`,
          toolCalls: [
            {
              name: 'create_appointment',
              arguments: {
                title: draft.title,
                startAt: draft.startAt,
                location: draft.location || undefined,
              },
              result: created,
              status: 'executed',
            },
          ],
          needsHuman: false,
          grounding: { grounded: false, fallbackReason: null },
          debug: {
            actionKey: 'appointments.create.confirm',
            detail: 'Se reconstruyó el payload de cita desde el turno previo y se ejecutó create_appointment.',
          },
        }
      } catch (error) {
        return {
          text:
            'La confirmación fue recibida, pero la creación de la cita falló. Revisa el payload y el error reportado abajo.',
          toolCalls: [
            {
              name: 'create_appointment',
              arguments: {
                title: draft.title,
                startAt: draft.startAt,
                location: draft.location || undefined,
              },
              result: null,
              status: 'failed',
              errorMessage:
                error instanceof Error ? error.message : 'create_appointment failed',
            },
          ],
          needsHuman: true,
          grounding: { grounded: false, fallbackReason: 'execution_failed' },
          debug: {
            actionKey: 'appointments.create.confirm',
            detail:
              error instanceof Error ? error.message : 'create_appointment failed',
          },
        }
      }
    }

    return null
  }

  resolveTaskMemory(snapshot, conversationId, role, scope, input, actionIntent) {
    const now = new Date().toISOString()
    const previousTaskState = snapshot?.taskState ?? null
    const previousIntentKey = previousTaskState?.intentKey || null
    let currentIntentKey = deriveIntentKey(role, input, actionIntent)
    let currentTopicTokens = extractTopicTokens(input)

    if (
      !(role.startsWith('admin_') || role === 'superadmin') &&
      previousIntentKey &&
      currentIntentKey === 'customer.other' &&
      looksLikeCustomerFollowUp(input)
    ) {
      currentIntentKey = previousIntentKey
      currentTopicTokens = Array.from(
        new Set([...(previousTaskState?.topicTokens ?? []), ...currentTopicTokens]),
      ).slice(0, 12)
    }

    const previousNamespace = intentNamespace(previousIntentKey)
    const currentNamespace = intentNamespace(currentIntentKey)
    const overlap = calculateTopicOverlap(
      previousTaskState?.topicTokens ?? [],
      currentTopicTokens,
    )

    let shouldReset = explicitResetRequested(input)

    if (!shouldReset && previousTaskState) {
      if (role.startsWith('admin_') || role === 'superadmin') {
        shouldReset =
          previousNamespace !== currentNamespace ||
          ((currentNamespace === 'aberturas' || previousNamespace === 'aberturas') &&
            overlap < 0.18 &&
            currentTopicTokens.length > 0)
      } else {
        shouldReset =
          previousIntentKey !== currentIntentKey &&
          overlap < 0.12 &&
          currentIntentKey !== 'customer.light'
      }
    }

    const taskId = shouldReset
      ? `${conversationId}:${Date.now()}`
      : previousTaskState?.taskId || `${conversationId}:1`

    const nextSnapshot = snapshot ?? {
      conversationId,
      scope,
      role,
      turns: [],
      summary: null,
      compiledContext: null,
      taskState: null,
      updatedAt: now,
    }

    nextSnapshot.scope = scope
    nextSnapshot.role = role
    nextSnapshot.updatedAt = now
    const history = (nextSnapshot.turns ?? [])
      .filter((turn) => turn?.metadata?.taskId === taskId)
      .slice(-(getRoleConfig(role, this.roleCatalog)?.memoryTurns ?? 8))
    const taskSummary = buildTaskSummary(currentIntentKey, history, input)
    const currentTask = {
      intentKey: currentIntentKey,
      entities: currentTopicTokens.map((token) => ({
        type: 'topic_token',
        value: token,
      })),
      status: 'open',
      lastUpdate: now,
    }

    nextSnapshot.taskState = {
      taskId,
      intentKey: currentIntentKey,
      topicTokens: currentTopicTokens,
      taskSummary,
      currentTask,
      resetCount: (previousTaskState?.resetCount ?? 0) + (shouldReset ? 1 : 0),
      lastResetAt: shouldReset ? now : previousTaskState?.lastResetAt ?? null,
      updatedAt: now,
    }

    return {
      snapshot: nextSnapshot,
      taskId,
      intentKey: currentIntentKey,
      taskSummary,
      currentTask,
      resetApplied: shouldReset,
      resetCount: nextSnapshot.taskState.resetCount,
      lastResetAt: nextSnapshot.taskState.lastResetAt,
      history,
    }
  }

  buildRoleBlockedResponse(role, roleResolution = { ambiguous: false }) {
    if (role.startsWith('admin_') || role === 'superadmin') {
      if (roleResolution?.ambiguous) {
        return 'La configuración actual de grupos y capacidades cubre varias áreas y esta gestión no quedó asociada a un perfil operativo claro para la asistencia automática. Continúa por la vía operativa habitual o revisa la configuración del usuario antes de volver a intentarlo.'
      }
      return 'Esa acción no está habilitada para tu rol conversacional actual. Si corresponde, deriva el caso al perfil interno adecuado o continúa con un takeover humano.'
    }

    return 'Puedo ayudarte con orientación y consultas seguras, pero esa gestión la continúa un asesor del equipo por el canal correspondiente.'
  }
}
