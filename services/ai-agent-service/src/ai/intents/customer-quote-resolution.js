import { extractCustomerQuoteLeadText } from './customer-quote-context.js'

const PRODUCT_TOPIC_TYPES = new Set([
  'product_family',
  'product_topic',
  'product_variant',
])

const IMMEDIATE_PRICING_STRATEGIES = new Set([
  'immediate_unit_price',
  'immediate_square_meter',
  'parametric_exact_or_handoff',
])

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
  'en',
  'al',
  'lo',
  'se',
  'seria',
  'sería',
  'quiero',
  'quisiera',
  'preciso',
  'necesito',
  'cotizar',
  'presupuesto',
  'cotizacion',
  'cotización',
  'precio',
  'precios',
  'costo',
  'costos',
  'medida',
  'medidas',
  'ancho',
  'alto',
])

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeText = (value) =>
  compactText(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' '),
  )

const normalizeKey = (value) =>
  normalizeText(value)
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')

const tokenize = (value) =>
  normalizeText(value)
    .split(' ')
    .map((entry) => entry.trim())
    .filter((entry) => entry && !STOP_TOKENS.has(entry))

const dedupeStrings = (values = []) => {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const clean = compactText(value)
    const key = normalizeText(clean)
    if (!clean || !key || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(clean)
  }
  return result
}

const GENERIC_PRODUCT_DESCRIPTOR_TOKENS = new Set([
  'producto',
  'productos',
  'item',
  'items',
  'solucion',
  'soluciones',
])

const formatMeasurementTokenFromMm = (widthMm, heightMm) => {
  if (
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm) ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    return null
  }

  return `${Math.round(widthMm)}x${Math.round(heightMm)}`
}

const resolveQuoteSubjectLabel = (interpretation = null, quoteContext = null) => {
  const currentTopic =
    interpretation?.topic &&
    PRODUCT_TOPIC_TYPES.has(String(interpretation.topic.type || ''))
      ? compactText(interpretation.topic.label)
      : null
  const currentContextTopic =
    interpretation?.contextTopic &&
    PRODUCT_TOPIC_TYPES.has(String(interpretation.contextTopic.type || ''))
      ? compactText(interpretation.contextTopic.label)
      : null
  const familyLabel = compactText(quoteContext?.familyLabel || '')

  if (
    currentTopic &&
    String(interpretation?.topic?.type || '') === 'product_variant' &&
    familyLabel &&
    !normalizeText(currentTopic).includes(normalizeText(familyLabel))
  ) {
    return compactText(`${familyLabel} ${currentTopic}`)
  }

  return (
    currentTopic ||
    compactText(quoteContext?.topicLabel || '') ||
    familyLabel ||
    currentContextTopic ||
    null
  )
}

const buildQuoteSearchQueries = (interpretation = null, quoteContext = null) => {
  const currentTopic =
    interpretation?.topic &&
    PRODUCT_TOPIC_TYPES.has(String(interpretation.topic.type || ''))
      ? compactText(interpretation.topic.label)
      : null
  const contextTopic =
    interpretation?.contextTopic &&
    PRODUCT_TOPIC_TYPES.has(String(interpretation.contextTopic.type || ''))
      ? compactText(interpretation.contextTopic.label)
      : null
  const familyLabel = compactText(quoteContext?.familyLabel || '')
  const subjectLabel = resolveQuoteSubjectLabel(interpretation, quoteContext)

  return dedupeStrings([
    subjectLabel,
    currentTopic,
    contextTopic,
    familyLabel && currentTopic ? `${familyLabel} ${currentTopic}` : null,
    familyLabel && contextTopic ? `${familyLabel} ${contextTopic}` : null,
    familyLabel,
  ])
}

const buildPublishedCatalogExactQueries = ({
  input,
  interpretation = null,
  quoteContext = null,
}) => {
  const subjectLabel = resolveQuoteSubjectLabel(interpretation, quoteContext)
  const baseQueries = buildQuoteSearchQueries(interpretation, quoteContext)
  const leadText = extractCustomerQuoteLeadText(input)
  const series = compactText(quoteContext?.series || '')
  const glass = compactText(quoteContext?.glass || '')
  const color = compactText(quoteContext?.color || '')
  const measurementItems = buildEffectiveMeasurementItems(quoteContext)
  const measurementTokens = dedupeStrings(
    measurementItems
      .map((entry) => formatMeasurementTokenFromMm(entry?.widthMm, entry?.heightMm))
      .filter(Boolean),
  )

  const attributeBlocks = dedupeStrings([
    compactText([series, color, glass].filter(Boolean).join(' ')),
    compactText([series, glass].filter(Boolean).join(' ')),
    compactText([series, color].filter(Boolean).join(' ')),
    compactText([color, glass].filter(Boolean).join(' ')),
  ])

  return dedupeStrings([
    leadText,
    ...baseQueries,
    ...measurementTokens,
    ...measurementTokens.flatMap((measurementToken) => [
      compactText([subjectLabel, ...attributeBlocks, measurementToken].filter(Boolean).join(' ')),
      compactText([subjectLabel, series, color, glass, measurementToken].filter(Boolean).join(' ')),
      compactText([series, color, glass, measurementToken].filter(Boolean).join(' ')),
      compactText([series, measurementToken].filter(Boolean).join(' ')),
      compactText([color, glass, measurementToken].filter(Boolean).join(' ')),
      measurementToken,
    ]),
  ])
}

const buildIgnoredExactCatalogTokens = (quoteContext = null) =>
  new Set(
    tokenize(
      [
        quoteContext?.familyLabel,
        quoteContext?.topicLabel,
        quoteContext?.series,
        quoteContext?.glass,
        quoteContext?.color,
      ]
        .filter(Boolean)
        .join(' '),
    ),
  )

const extractMeasurementTokensFromValue = (value) => {
  const tokens = []
  const pattern = /(\d{3,4})\s*[xX]\s*(\d{3,4})/g
  const source = String(value || '')
  let match = pattern.exec(source)
  while (match) {
    const width = Number(match[1] || 0)
    const height = Number(match[2] || 0)
    if (width > 0 && height > 0) {
      tokens.push(formatMeasurementTokenFromMm(width, height))
    }
    match = pattern.exec(source)
  }
  return dedupeStrings(tokens)
}

const buildRequestedMeasurementTokens = (quoteContext = null) =>
  dedupeStrings(
    buildEffectiveMeasurementItems(quoteContext)
      .map((entry) => formatMeasurementTokenFromMm(entry?.widthMm, entry?.heightMm))
      .filter(Boolean),
  )

const productMatchesRequestedMeasurements = (
  product = null,
  requestedMeasurementTokens = [],
) => {
  const requestedTokens = dedupeStrings(requestedMeasurementTokens)
  if (!requestedTokens.length) {
    return true
  }

  const productMeasurementTokens = new Set(
    dedupeStrings([
      ...extractMeasurementTokensFromValue(product?.name),
      ...extractMeasurementTokensFromValue(product?.productCode),
      ...extractMeasurementTokensFromValue(product?.shortDescription),
    ]),
  )

  if (!productMeasurementTokens.size) {
    return false
  }

  return requestedTokens.some((token) => productMeasurementTokens.has(token))
}

const productHasDistinctiveDescriptorOverlap = (
  product = null,
  input = null,
  quoteContext = null,
) => {
  const leadTokens = new Set(tokenize(extractCustomerQuoteLeadText(input)))
  if (!leadTokens.size) {
    return false
  }

  const ignoredTokens = buildIgnoredExactCatalogTokens(quoteContext)
  const productDescriptorTokens = tokenize(
    [product?.name, product?.productCode].filter(Boolean).join(' '),
  ).filter(
    (token) =>
      token &&
      !ignoredTokens.has(token) &&
      !GENERIC_PRODUCT_DESCRIPTOR_TOKENS.has(token) &&
      !/\d/.test(token),
  )

  return productDescriptorTokens.some((token) => leadTokens.has(token))
}

const collectOperationalProductMatches = (operationalContext = null) => {
  if (!Array.isArray(operationalContext?.toolCalls)) {
    return []
  }

  const items = []
  for (const entry of operationalContext.toolCalls) {
    if (entry?.name !== 'search_products' || entry?.status !== 'executed') {
      continue
    }
    if (!Array.isArray(entry.result)) {
      continue
    }
    items.push(...entry.result.filter((item) => item && typeof item === 'object'))
  }
  return items
}

const collectCandidateProducts = async ({
  queries = [],
  backendClient,
  operationalContext = null,
}) => {
  const seenProductIds = new Set()
  const candidateProducts = []

  const pushProducts = (products = []) => {
    for (const product of products) {
      const id = Number(product?.id || 0)
      const dedupeKey = id > 0 ? `id:${id}` : normalizeKey(product?.name)
      if (!dedupeKey || seenProductIds.has(dedupeKey)) {
        continue
      }
      seenProductIds.add(dedupeKey)
      candidateProducts.push(product)
    }
  }

  pushProducts(collectOperationalProductMatches(operationalContext))

  for (const query of Array.isArray(queries) ? queries : []) {
    const products = await backendClient.searchProducts(query, 5)
    pushProducts(products)
  }

  return candidateProducts
}

const productMatchesStrategy = (product = null, pricingStrategy = null) => {
  if (!product || typeof product !== 'object') {
    return false
  }

  if (String(product.mode || '').toUpperCase() === 'PARAMETRIC') {
    return false
  }

  const unit = String(product.unitOfMeasure || '').toUpperCase()
  if (pricingStrategy === 'immediate_square_meter') {
    return unit === 'SQUARE_METER'
  }
  if (pricingStrategy === 'immediate_unit_price') {
    return unit === 'UNIT' || !unit
  }
  return true
}

const scoreProductAgainstQuery = (
  product = null,
  query = null,
  pricingStrategy = null,
  options = {},
) => {
  if (!options.allowStrategyMismatch && !productMatchesStrategy(product, pricingStrategy)) {
    return Number.NEGATIVE_INFINITY
  }

  const queryTokens = tokenize(query)
  const nameTokens = tokenize(product?.name)
  const codeTokens = tokenize(product?.productCode)
  const categoryTokens = tokenize(product?.category?.name)
  const allProductTokens = new Set([...nameTokens, ...codeTokens, ...categoryTokens])
  const overlap = queryTokens.filter((token) => allProductTokens.has(token)).length

  let score = overlap * 10
  if (queryTokens.length > 0 && overlap === queryTokens.length) {
    score += 12
  }

  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(product?.name)
  if (normalizedQuery && normalizedName.includes(normalizedQuery)) {
    score += 18
  }
  if (
    normalizedQuery &&
    typeof product?.productCode === 'string' &&
    normalizeText(product.productCode).includes(normalizedQuery)
  ) {
    score += 14
  }

  if (pricingStrategy === 'immediate_square_meter') {
    score += 6
  }
  if (pricingStrategy === 'immediate_unit_price') {
    score += 4
  }

  return score
}

const rankProductMatches = (
  products = [],
  queries = [],
  pricingStrategy = null,
  options = {},
) => {
  const ranked = []
  for (const product of Array.isArray(products) ? products : []) {
    let bestScore = Number.NEGATIVE_INFINITY
    for (const query of queries) {
      const score = scoreProductAgainstQuery(product, query, pricingStrategy, options)
      if (score > bestScore) {
        bestScore = score
      }
    }
    if (bestScore > Number.NEGATIVE_INFINITY) {
      ranked.push({
        product,
        score: bestScore,
        strategyCompatible: productMatchesStrategy(product, pricingStrategy),
      })
    }
  }

  return ranked.sort((left, right) => right.score - left.score)
}

const selectBestProductMatch = (products = [], queries = [], pricingStrategy = null) => {
  const ranked = rankProductMatches(products, queries, pricingStrategy)
  const best = ranked[0] || null
  if (!best || best.score < 6) {
    return null
  }
  return best.product
}

const buildEffectiveMeasurementItems = (quoteContext = null) => {
  const rawItems = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems.filter((entry) => entry && typeof entry === 'object')
    : []
  const totalQuantity = Number(quoteContext?.quantity?.total || 0)

  if (rawItems.length === 0) {
    if (!quoteContext?.measurements) {
      return []
    }
    return [
      {
        widthMm: Number(quoteContext.measurements.widthMm || 0),
        heightMm: Number(quoteContext.measurements.heightMm || 0),
        displayLabel:
          quoteContext.measurements.displayLabel ||
          quoteContext.measurements.confirmationLabel ||
          null,
        quantity: totalQuantity > 0 ? totalQuantity : 1,
      },
    ]
  }

  const specifiedQuantity = rawItems.reduce(
    (sum, entry) => sum + (Number(entry.quantity || 0) > 0 ? Number(entry.quantity) : 0),
    0,
  )
  const missingQuantityItems = rawItems.filter((entry) => !(Number(entry.quantity || 0) > 0))
  const remainingQuantity =
    totalQuantity > specifiedQuantity ? totalQuantity - specifiedQuantity : null

  return rawItems.map((entry, index) => {
    const explicitQuantity = Number(entry.quantity || 0)
    let quantity = explicitQuantity > 0 ? explicitQuantity : 1

    if (rawItems.length === 1 && totalQuantity > 0) {
      quantity = totalQuantity
    } else if (
      explicitQuantity <= 0 &&
      missingQuantityItems.length === 1 &&
      typeof remainingQuantity === 'number' &&
      remainingQuantity > 0
    ) {
      quantity = remainingQuantity
    }

    return {
      widthMm: Number(entry.widthMm || 0),
      heightMm: Number(entry.heightMm || 0),
      displayLabel: entry.displayLabel || entry.confirmationLabel || null,
      quantity,
      lineNumber: Number(entry.lineNumber || index + 1),
    }
  })
}

const formatMeasurementFromMm = (widthMm, heightMm) => {
  if (
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm) ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    return null
  }

  const unit =
    widthMm <= 5000 && heightMm <= 5000 && widthMm % 10 === 0 && heightMm % 10 === 0
      ? 'm'
      : 'cm'

  const formatter =
    unit === 'm'
      ? new Intl.NumberFormat('es-UY', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: false,
        })
      : new Intl.NumberFormat('es-UY', {
          maximumFractionDigits: 0,
          useGrouping: false,
        })

  const divisor = unit === 'm' ? 1000 : 10
  return `${formatter.format(widthMm / divisor)} x ${formatter.format(heightMm / divisor)} ${unit}`
}

const formatAreaM2 = (value) =>
  new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value)

const formatAmount = (currency, amount) => {
  if (!currency || !Number.isFinite(amount)) {
    return null
  }
  return `${String(currency).toUpperCase()} ${new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

const buildParametricQuotePayloadText = (quoteContext = null, interpretation = null) => {
  const subjectLabel = resolveQuoteSubjectLabel(interpretation, quoteContext) || 'aberturas'
  const series = compactText(quoteContext?.series || '')
  const glass = compactText(quoteContext?.glass || '')
  const color = compactText(quoteContext?.color || '')
  const items = buildEffectiveMeasurementItems(quoteContext)

  if (!items.length) {
    return compactText(
      `${subjectLabel} serie ${series} color ${color} con ${glass}`.replace(/\s+/g, ' '),
    )
  }

  return items
    .map((item) => {
      const measurementLabel =
        item.displayLabel || formatMeasurementFromMm(item.widthMm, item.heightMm) || ''
      const quantity = Number(item.quantity || 1)
      return compactText(
        `${quantity} ${subjectLabel} serie ${series} color ${color} con ${glass} de ${measurementLabel}`,
      )
    })
    .join('\n')
}

const buildParametricResolutionFromPreparedQuote = ({
  preparedQuote,
  quoteContext,
  interpretation,
}) => {
  const items = Array.isArray(preparedQuote?.items)
    ? preparedQuote.items.filter((entry) => entry && typeof entry === 'object')
    : []
  if (!items.length) {
    return {
      strategy: 'parametric_exact_or_handoff',
      status: 'needs_handoff',
      subjectLabel: resolveQuoteSubjectLabel(interpretation, quoteContext),
      detail: preparedQuote?.summary || null,
    }
  }

  const measurementItems = buildEffectiveMeasurementItems(quoteContext)
  const quantitiesByIndex = measurementItems.map((entry) =>
    Number(entry.quantity || 1) > 0 ? Number(entry.quantity) : 1,
  )

  const readyItems = items.filter((entry) => entry.readyForQuote && entry.draftItem?.price != null)
  if (readyItems.length !== items.length) {
    return {
      strategy: 'parametric_exact_or_handoff',
      status: 'needs_handoff',
      subjectLabel: resolveQuoteSubjectLabel(interpretation, quoteContext),
      detail: preparedQuote?.summary || null,
      preparedQuote,
    }
  }

  let totalAmount = 0
  let currency = null
  const resolvedItems = readyItems.map((entry, index) => {
    const unitAmount = Number(entry?.draftItem?.price || 0)
    const quantity = quantitiesByIndex[index] || Number(quoteContext?.quantity?.total || 1) || 1
    const amount = unitAmount * quantity
    totalAmount += amount
    currency = currency || entry?.draftItem?.currency || entry?.pricing?.currency || null

    return {
      quantity,
      unitAmount,
      amount,
      currency: entry?.draftItem?.currency || entry?.pricing?.currency || null,
      name: entry?.draftItem?.name || null,
      widthMm: Number(entry?.widthMm || 0),
      heightMm: Number(entry?.heightMm || 0),
      lineNumber: Number(entry?.lineNumber || index + 1),
    }
  })

  return {
    strategy: 'parametric_exact_or_handoff',
    status: 'resolved',
    subjectLabel: resolveQuoteSubjectLabel(interpretation, quoteContext),
    quantity:
      Number(quoteContext?.quantity?.total || 0) > 0
        ? Number(quoteContext.quantity.total)
        : resolvedItems.reduce((sum, entry) => sum + entry.quantity, 0),
    totalAmount,
    currency,
    preparedQuote,
    items: resolvedItems,
    exact: readyItems.every((entry) => entry?.pricing?.exact !== false),
  }
}

const buildImmediateUnitResolutionFromPublishedCatalog = async ({
  input,
  interpretation = null,
  quoteContext = null,
  operationalContext = null,
  backendClient,
}) => {
  const queries = buildPublishedCatalogExactQueries({
    input,
    interpretation,
    quoteContext,
  })
  if (!queries.length) {
    return null
  }

  const candidateProducts = await collectCandidateProducts({
    queries,
    backendClient,
    operationalContext,
  })

  const rankedCompatibleMatches = rankProductMatches(
    candidateProducts,
    queries,
    'immediate_unit_price',
  )
  const requestedMeasurementTokens = buildRequestedMeasurementTokens(quoteContext)
  const measurementCompatibleMatches = requestedMeasurementTokens.length
    ? rankedCompatibleMatches.filter((entry) =>
        productMatchesRequestedMeasurements(entry.product, requestedMeasurementTokens),
      )
    : rankedCompatibleMatches
  const effectiveRankedMatches =
    measurementCompatibleMatches.length > 0
      ? measurementCompatibleMatches
      : requestedMeasurementTokens.length > 0
        ? []
        : rankedCompatibleMatches

  const strongestCompatibleMatch = effectiveRankedMatches[0] || null
  if (!strongestCompatibleMatch || strongestCompatibleMatch.score < 6) {
    return null
  }

  if (
    effectiveRankedMatches.length > 1 &&
    effectiveRankedMatches[1].score >= strongestCompatibleMatch.score - 4
  ) {
    return {
      strategy: 'immediate_unit_price',
      status: 'product_not_found',
      subjectLabel: resolveQuoteSubjectLabel(interpretation, quoteContext),
      queries,
      productNotFoundSubtype: 'catalog_match_ambiguous',
      candidateProducts: effectiveRankedMatches.slice(0, 3).map((entry) => entry.product),
    }
  }

  const productMatch = strongestCompatibleMatch.product
  if (!productHasDistinctiveDescriptorOverlap(productMatch, input, quoteContext)) {
    return null
  }

  const currency =
    typeof productMatch.currency === 'string' && productMatch.currency.trim()
      ? productMatch.currency.trim().toUpperCase()
      : null
  const unitAmount =
    typeof productMatch.amount === 'number' && Number.isFinite(productMatch.amount)
      ? Number(productMatch.amount)
      : null
  if (unitAmount == null || !currency) {
    return {
      strategy: 'immediate_unit_price',
      status: 'product_not_found',
      subjectLabel: productMatch.name || resolveQuoteSubjectLabel(interpretation, quoteContext),
      productMatch,
      queries,
      productNotFoundSubtype: 'catalog_present_without_immediate_price',
    }
  }

  const quantity =
    Number(quoteContext?.quantity?.total || 0) > 0 ? Number(quoteContext.quantity.total) : 1
  const preview = await backendClient.previewProductQuote({
    productId: Number(productMatch.id),
    quantity,
  })

  if (!preview?.available || !Number.isFinite(Number(preview.totalAmount))) {
    return {
      strategy: 'immediate_unit_price',
      status: 'needs_handoff',
      subjectLabel: productMatch.name || resolveQuoteSubjectLabel(interpretation, quoteContext),
      productMatch,
      detail: 'immediate_preview_unavailable',
      preview,
    }
  }

  return {
    strategy: 'immediate_unit_price',
    status: 'resolved',
    subjectLabel: productMatch.name || resolveQuoteSubjectLabel(interpretation, quoteContext),
    productMatch,
    quantity: Number(preview.quantity || quantity || 1),
    unitAmount:
      Number.isFinite(Number(preview.unitAmount)) ? Number(preview.unitAmount) : unitAmount,
    totalAmount: Number(preview.totalAmount),
    currency: String(preview.currency || currency || '').trim().toUpperCase() || currency,
    preview,
  }
}

export const resolveCustomerQuoteResolution = async ({
  input,
  interpretation = null,
  operationalContext = null,
  backendClient,
  tenantKey = null,
  role = null,
}) => {
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  if (!quoteContext) {
    return null
  }

  const pricingStrategy = String(quoteContext.pricingStrategy || '').trim()
  if (!IMMEDIATE_PRICING_STRATEGIES.has(pricingStrategy)) {
    return null
  }
  if (String(quoteContext.completionStatus || '') !== 'ready_for_pricing_or_handoff') {
    return null
  }

  const subjectLabel = resolveQuoteSubjectLabel(interpretation, quoteContext)

  if (pricingStrategy === 'parametric_exact_or_handoff') {
    const publishedCatalogResolution =
      await buildImmediateUnitResolutionFromPublishedCatalog({
        input,
        interpretation,
        quoteContext,
        operationalContext,
        backendClient,
      })
    if (publishedCatalogResolution) {
      return publishedCatalogResolution
    }

    if (role === 'customer_public' || role === 'customer_authenticated') {
      return {
        strategy: 'parametric_exact_or_handoff',
        status: 'needs_handoff',
        subjectLabel,
        detail: 'external_parametric_quote_required',
      }
    }

    const payloadText = buildParametricQuotePayloadText(quoteContext, interpretation)
    const preparedQuote = await backendClient.prepareAberturasQuote({
      text: payloadText || String(input || ''),
      source: 'customer_public_chat',
    })
    return buildParametricResolutionFromPreparedQuote({
      preparedQuote,
      quoteContext,
      interpretation,
    })
  }

  const queries = buildQuoteSearchQueries(interpretation, quoteContext)
  const candidateProducts = await collectCandidateProducts({
    queries,
    backendClient,
    operationalContext,
  })

  const rankedCompatibleMatches = rankProductMatches(
    candidateProducts,
    queries,
    pricingStrategy,
  )
  const strongestCompatibleMatch = rankedCompatibleMatches[0] || null
  if (
    strongestCompatibleMatch &&
    strongestCompatibleMatch.score >= 6 &&
    rankedCompatibleMatches.length > 1 &&
    rankedCompatibleMatches[1].score >= strongestCompatibleMatch.score - 4
  ) {
    return {
      strategy: pricingStrategy,
      status: 'product_not_found',
      subjectLabel,
      queries,
      productNotFoundSubtype: 'catalog_match_ambiguous',
      candidateProducts: rankedCompatibleMatches.slice(0, 3).map((entry) => entry.product),
    }
  }

  const productMatch =
    strongestCompatibleMatch && strongestCompatibleMatch.score >= 6
      ? strongestCompatibleMatch.product
      : null
  if (!productMatch) {
    const rankedAnyMatches = rankProductMatches(candidateProducts, queries, pricingStrategy, {
      allowStrategyMismatch: true,
    })
    const strongestAnyMatch = rankedAnyMatches[0] || null
    if (
      strongestAnyMatch &&
      strongestAnyMatch.score >= 6 &&
      strongestAnyMatch.strategyCompatible === false
    ) {
      return {
        strategy: pricingStrategy,
        status: 'product_not_found',
        subjectLabel,
        queries,
        productNotFoundSubtype: 'catalog_present_but_strategy_unavailable',
        candidateProducts: rankedAnyMatches.slice(0, 3).map((entry) => entry.product),
      }
    }

    let knowledgeHits = []
    for (const query of queries.slice(0, 2)) {
      try {
        const retrieval = await backendClient.searchKnowledge(
          query,
          'customer_public',
          3,
          tenantKey || undefined,
        )
        const items = Array.isArray(retrieval?.items)
          ? retrieval.items.filter((entry) => entry && typeof entry === 'object')
          : []
        knowledgeHits.push(...items)
      } catch {
        // keep a safe fallback if retrieval is unavailable
      }
      if (knowledgeHits.length >= 3) {
        break
      }
    }

    return {
      strategy: pricingStrategy,
      status: 'product_not_found',
      subjectLabel,
      queries,
      productNotFoundSubtype:
        knowledgeHits.length > 0
          ? 'catalog_missing_but_known_in_knowledge'
          : 'catalog_and_knowledge_missing',
      knowledgeHits: knowledgeHits.slice(0, 3),
    }
  }

  const currency =
    typeof productMatch.currency === 'string' && productMatch.currency.trim()
      ? productMatch.currency.trim().toUpperCase()
      : null
  const unitAmount =
    typeof productMatch.amount === 'number' && Number.isFinite(productMatch.amount)
      ? Number(productMatch.amount)
      : null
  if (unitAmount == null || !currency) {
    return {
      strategy: pricingStrategy,
      status: 'product_not_found',
      subjectLabel,
      productMatch,
      queries,
      productNotFoundSubtype: 'catalog_present_without_immediate_price',
    }
  }

  const measurementItems = buildEffectiveMeasurementItems(quoteContext)
  const quantity =
    Number(quoteContext?.quantity?.total || 0) > 0 ? Number(quoteContext.quantity.total) : 1

  const effectiveItems = measurementItems.filter(
    (entry) =>
      Number.isFinite(entry?.widthMm) &&
      Number.isFinite(entry?.heightMm) &&
      entry.widthMm > 0 &&
      entry.heightMm > 0,
  )

  const previewPayload =
    pricingStrategy === 'immediate_unit_price'
      ? {
          productId: Number(productMatch.id),
          quantity,
        }
      : {
          productId: Number(productMatch.id),
          quantity,
          ...(effectiveItems.length === 1
            ? {
                widthMm: Number(effectiveItems[0].widthMm),
                heightMm: Number(effectiveItems[0].heightMm),
              }
            : {}),
          ...(effectiveItems.length > 0
            ? {
                items: effectiveItems.map((entry) => ({
                  widthMm: Number(entry.widthMm),
                  heightMm: Number(entry.heightMm),
                  quantity: Number(entry.quantity || 1) > 0 ? Number(entry.quantity) : 1,
                })),
              }
            : {}),
        }

  if (pricingStrategy !== 'immediate_unit_price' && !effectiveItems.length) {
    return {
      strategy: pricingStrategy,
      status: 'needs_handoff',
      subjectLabel,
      productMatch,
      detail: 'missing_measurements',
    }
  }

  const preview = await backendClient.previewProductQuote(previewPayload)
  if (!preview?.available || !Number.isFinite(Number(preview.totalAmount))) {
    return {
      strategy: pricingStrategy,
      status: 'needs_handoff',
      subjectLabel,
      productMatch,
      detail: preview?.needsConfiguration ? 'missing_measurements' : 'immediate_preview_unavailable',
      preview,
    }
  }

  if (pricingStrategy === 'immediate_unit_price') {
    return {
      strategy: pricingStrategy,
      status: 'resolved',
      subjectLabel,
      productMatch,
      quantity: Number(preview.quantity || quantity || 1),
      unitAmount:
        Number.isFinite(Number(preview.unitAmount)) ? Number(preview.unitAmount) : unitAmount,
      totalAmount: Number(preview.totalAmount),
      currency: String(preview.currency || currency || '').trim().toUpperCase() || currency,
      preview,
    }
  }

  const pricedItems = effectiveItems.map((entry, index) => {
    const previewItem = Array.isArray(preview?.items) ? preview.items[index] : null
    const entryQuantity = Number(entry.quantity || 1) > 0 ? Number(entry.quantity) : 1
    return {
      widthMm: Number(entry.widthMm),
      heightMm: Number(entry.heightMm),
      displayLabel:
        entry.displayLabel ||
        formatMeasurementFromMm(Number(entry.widthMm), Number(entry.heightMm)),
      quantity: entryQuantity,
      areaM2:
        Number.isFinite(Number(previewItem?.measurementPerUnit))
          ? Number(previewItem.measurementPerUnit)
          : (Number(entry.widthMm) * Number(entry.heightMm)) / 1_000_000,
      amount:
        Number.isFinite(Number(previewItem?.totalAmount))
          ? Number(previewItem.totalAmount)
          : 0,
    }
  })
  const totalAreaM2 =
    Number.isFinite(Number(preview.effectiveQuantity))
      ? Number(preview.effectiveQuantity)
      : pricedItems.reduce((sum, entry) => sum + entry.areaM2 * entry.quantity, 0)
  const totalAmount = Number(preview.totalAmount)

  return {
    strategy: pricingStrategy,
    status: 'resolved',
    subjectLabel,
    productMatch,
    quantity:
      Number(preview.quantity || 0) > 0
        ? Number(preview.quantity)
        : quantity > 0
          ? quantity
          : pricedItems.reduce((sum, entry) => sum + entry.quantity, 0),
    unitAmount:
      Number.isFinite(Number(preview.unitAmount)) ? Number(preview.unitAmount) : unitAmount,
    totalAmount,
    totalAreaM2,
    currency: String(preview.currency || currency || '').trim().toUpperCase() || currency,
    items: pricedItems,
    measurementLabel:
      quoteContext?.measurements?.displayLabel ||
      quoteContext?.measurements?.confirmationLabel ||
      pricedItems[0]?.displayLabel ||
      null,
    preview,
  }
}

export const formatQuoteResolutionAmount = formatAmount
export const formatQuoteResolutionArea = formatAreaM2
