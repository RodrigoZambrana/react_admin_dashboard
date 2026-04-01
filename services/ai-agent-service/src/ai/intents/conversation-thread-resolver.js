import { extractCustomerQuotedMeasurements, extractCustomerQuoteLeadText } from './customer-quote-context.js'
import {
  findBestTenantTopicMatch,
  findTenantTopicMatches,
  isContextualTopicDescriptorMatch,
  normalizeCustomerTopicText,
} from './customer-topic-taxonomy.js'
import { isGenericQuoteTopicLabel } from './quote-semantics.js'

const normalizeText = normalizeCustomerTopicText

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const dedupe = (values = []) => Array.from(new Set(values.filter(Boolean)))

const mergeThreadLabels = (baseLabel, variantLabel) => {
  const cleanBaseLabel = compactText(baseLabel)
  const cleanVariantLabel = compactText(variantLabel)
  if (!cleanBaseLabel) {
    return cleanVariantLabel
  }
  if (!cleanVariantLabel) {
    return cleanBaseLabel
  }

  const normalizedBaseLabel = normalizeText(cleanBaseLabel)
  const normalizedVariantLabel = normalizeText(cleanVariantLabel)
  if (normalizedVariantLabel.includes(normalizedBaseLabel)) {
    return cleanVariantLabel
  }
  if (normalizedBaseLabel.includes(normalizedVariantLabel)) {
    return cleanBaseLabel
  }

  const baseTokens = normalizedBaseLabel.split(/\s+/u).filter(Boolean)
  const variantTokens = normalizedVariantLabel.split(/\s+/u).filter(Boolean)
  const maxOverlap = Math.min(baseTokens.length, variantTokens.length)
  let overlap = 0

  for (let size = maxOverlap; size >= 1; size -= 1) {
    const baseSuffix = baseTokens.slice(-size).join(' ')
    const variantPrefix = variantTokens.slice(0, size).join(' ')
    if (baseSuffix === variantPrefix) {
      overlap = size
      break
    }
  }

  if (overlap > 0) {
    return compactText(
      [
        cleanBaseLabel,
        cleanVariantLabel
          .split(/\s+/u)
          .slice(overlap)
          .join(' '),
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  return compactText([cleanBaseLabel, cleanVariantLabel].join(' '))
}

const normalizeCarrierTerms = (terms = []) =>
  Array.isArray(terms)
    ? dedupe(terms.map((entry) => normalizeText(entry)).filter(Boolean))
    : []

const buildThreadKey = (baseKey) => `thread:${String(baseKey || '').trim()}`

const resolveVariantBaseLabel = (match) => {
  const parentKeys = Array.isArray(match?.parentKeys) ? match.parentKeys : []
  const parentLabels = Array.isArray(match?.parentLabels) ? match.parentLabels : []
  const topicParentIndex = parentKeys.findIndex((entry) =>
    String(entry || '').startsWith('product_topic:'),
  )

  if (
    topicParentIndex >= 0 &&
    typeof parentLabels[topicParentIndex] === 'string' &&
    parentLabels[topicParentIndex].trim()
  ) {
    return parentLabels[topicParentIndex].trim()
  }

  return parentLabels.find(Boolean) || match?.familyLabel || match?.label || null
}

const createThreadFromMatch = (match) => {
  if (!match?.key || !match?.label) {
    return null
  }

  const baseType = match.kind === 'product_variant' ? 'product_topic' : match.kind
  const baseLabel =
    match.kind === 'product_variant'
      ? resolveVariantBaseLabel(match)
      : match.label
  const baseKey =
    match.kind === 'product_variant'
      ? match.parentKeys.find((entry) => String(entry || '').startsWith('product_topic:')) ||
        match.parentKeys[0] ||
        match.key
      : match.key

  return {
    key: buildThreadKey(baseKey),
    baseKey,
    baseLabel,
    baseType,
    familyLabel:
      match.familyLabel ||
      (match.kind === 'product_family' ? match.label : null) ||
      null,
    variantKeys: [],
    variantLabels: [],
    variantDisplayLabels: [],
    resolvedLabel: baseLabel,
    displayLabel: baseLabel,
    confidence: 0.7,
    source: 'thread_match',
  }
}

const resolveVariantDisplayLabel = (match) => {
  const alias = compactText(match?.matchedAlias || '')
  if (alias && alias.length > String(match?.label || '').length) {
    return alias
  }
  return compactText(match?.label || '')
}

const attachVariantToThread = (thread, match) => {
  if (!thread || !match?.key || !match?.label) {
    return thread
  }

  const nextThread = {
    ...thread,
    variantKeys: dedupe([...(thread.variantKeys || []), match.key]),
    variantLabels: dedupe([...(thread.variantLabels || []), match.label]),
    variantDisplayLabels: dedupe([
      ...(thread.variantDisplayLabels || []),
      resolveVariantDisplayLabel(match),
    ]),
  }

  const variantPhrase = nextThread.variantDisplayLabels.join(' ')
  const canonicalVariantPhrase = nextThread.variantLabels.join(' ')
  nextThread.displayLabel = mergeThreadLabels(nextThread.baseLabel, variantPhrase)
  nextThread.resolvedLabel = mergeThreadLabels(
    nextThread.baseLabel,
    canonicalVariantPhrase,
  )
  nextThread.confidence = Math.max(Number(thread.confidence || 0), 0.84)
  nextThread.source = 'thread_variant_merge'
  return nextThread
}

const cloneThread = (thread = null) =>
  thread && typeof thread === 'object'
    ? {
        ...thread,
        variantKeys: Array.isArray(thread.variantKeys) ? [...thread.variantKeys] : [],
        variantLabels: Array.isArray(thread.variantLabels) ? [...thread.variantLabels] : [],
        variantDisplayLabels: Array.isArray(thread.variantDisplayLabels)
          ? [...thread.variantDisplayLabels]
          : [],
      }
    : null

const buildFallbackThreadFromPreviousTaskState = (
  previousTaskState = null,
  tenantTopicTaxonomy = [],
) => {
  const previousQuoteContext =
    previousTaskState?.quoteContext && typeof previousTaskState.quoteContext === 'object'
      ? previousTaskState.quoteContext
      : null
  const previousCanonicalTopic =
    previousTaskState?.canonicalTopic && typeof previousTaskState.canonicalTopic === 'object'
      ? previousTaskState.canonicalTopic
      : null
  const previousLabel = compactText(
    previousQuoteContext?.topicLabel || previousCanonicalTopic?.label || '',
  )
  if (!previousLabel || isGenericQuoteTopicLabel(previousLabel)) {
    return null
  }

  const previousMatch = findBestTenantTopicMatch(previousLabel, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
  })
  if (previousMatch) {
    let thread = createThreadFromMatch(previousMatch)
    if (previousMatch.kind === 'product_variant') {
      thread = attachVariantToThread(thread, previousMatch)
    }
    const previousVariantLabel = compactText(previousQuoteContext?.variantLabel || '')
    if (
      thread &&
      previousMatch.kind === 'product_topic' &&
      previousVariantLabel &&
      !normalizeText(thread.resolvedLabel || '').includes(normalizeText(previousVariantLabel))
    ) {
      const variantMatch = findBestTenantTopicMatch(previousVariantLabel, tenantTopicTaxonomy, {
        kinds: ['product_variant'],
      })
      if (
        variantMatch &&
        Array.isArray(variantMatch.parentKeys) &&
        variantMatch.parentKeys.includes(thread.baseKey)
      ) {
        thread = attachVariantToThread(thread, variantMatch)
      }
    }
    return thread
  }

  const syntheticBaseLabel = previousLabel
  const syntheticBaseKey = `synthetic:${normalizeText(syntheticBaseLabel).replace(/\s+/g, '-')}`
  return {
    key: buildThreadKey(syntheticBaseKey),
    baseKey: syntheticBaseKey,
    baseLabel: syntheticBaseLabel,
    baseType:
      typeof previousCanonicalTopic?.type === 'string'
        ? previousCanonicalTopic.type
        : 'product_topic',
    familyLabel:
      compactText(previousQuoteContext?.familyLabel || previousCanonicalTopic?.familyLabel || '') ||
      null,
    variantKeys: [],
    variantLabels: [],
    variantDisplayLabels: [],
    resolvedLabel: syntheticBaseLabel,
    displayLabel: syntheticBaseLabel,
    confidence:
      typeof previousCanonicalTopic?.confidence === 'number'
        ? previousCanonicalTopic.confidence
        : 0.62,
    source: 'conversation_memory_fallback',
  }
}

const buildPrioritizedBaseMatches = (leadText, taxonomy = [], measurementCarrierTerms = []) => {
  const matches = findTenantTopicMatches(leadText, taxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
    limit: 12,
  })
  const carriers = new Set(normalizeCarrierTerms(measurementCarrierTerms))
  const normalizedLeadText = normalizeText(leadText)
  const isConfigurationOnlyWithoutFamilyCompanion = (match) =>
    isContextualTopicDescriptorMatch(match, normalizedLeadText) &&
    !matches.some(
      (entry) =>
        entry !== match &&
        entry?.kind === 'product_family' &&
        normalizeText(entry.label || '') === normalizeText(match?.familyLabel || ''),
    )
  const nonConfigurationOnlyTopicKeys = new Set(
    matches
      .filter(
        (entry) =>
          entry?.kind === 'product_topic' &&
          !isConfigurationOnlyWithoutFamilyCompanion(entry),
      )
      .map((entry) => String(entry.key || ''))
      .filter(Boolean),
  )
  const prioritized = []

  for (const match of matches) {
    if (
      match.kind === 'product_topic' &&
      matches.some(
        (entry) =>
          entry.kind === 'product_family' &&
          normalizeText(entry.label) === normalizeText(match.familyLabel || '') &&
          normalizeText(entry.matchedAlias || '') === normalizeText(match.matchedAlias || ''),
      )
    ) {
      continue
    }

    if (
      match.kind === 'product_family' &&
      carriers.has(normalizeText(match.matchedAlias || ''))
    ) {
      continue
    }

    if (
      match.kind === 'product_family' &&
      matches.some(
        (entry) =>
          entry !== match &&
          entry.kind === 'product_topic' &&
          normalizeText(entry.familyLabel || '') === normalizeText(match.label) &&
          nonConfigurationOnlyTopicKeys.has(String(entry.key || '')),
      )
    ) {
      continue
    }

    if (isConfigurationOnlyWithoutFamilyCompanion(match)) {
      continue
    }

    prioritized.push(match)
  }

  return prioritized
}

const selectActiveThreadFromExplicitMatches = ({
  currentBaseThreads = [],
  previousActiveThread = null,
  normalizedInput = '',
}) => {
  if (currentBaseThreads.length === 1) {
    return currentBaseThreads[0]
  }

  if (currentBaseThreads.length <= 1) {
    return null
  }

  if (previousActiveThread) {
    const matchingPrevious = currentBaseThreads.find(
      (entry) => entry.baseKey === previousActiveThread.baseKey,
    )
    if (
      matchingPrevious &&
      /^(y|tambien|también|ademas|además)\b/.test(normalizedInput)
    ) {
      return matchingPrevious
    }
  }

  return null
}

const buildDisambiguationPrompt = (threads = []) => {
  const labels = threads
    .map((entry) =>
      compactText(entry?.displayLabel || entry?.resolvedLabel || entry?.baseLabel || ''),
    )
    .filter(Boolean)
  if (labels.length < 2) {
    return null
  }

  const joined =
    labels.length === 2
      ? `${labels[0]} y ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`

  return `Perfecto. Podemos ver ${joined}. ¿Querés que empecemos por ${labels[0]} o por ${labels[1]}?`
}

const inferMeasurementOnlyTurn = ({ currentTurnText = '', nluAnalysis = null }) =>
  Boolean(
    extractCustomerQuotedMeasurements(currentTurnText) ||
      nluAnalysis?.entities?.dimensionPairs?.length,
  )

export const resolveConversationThreads = ({
  currentTurnText,
  previousTaskState = null,
  tenantTopicTaxonomy = [],
  measurementCarrierTerms = [],
  nluAnalysis = null,
}) => {
  const leadText = extractCustomerQuoteLeadText(currentTurnText)
  const normalizedInput = normalizeText(currentTurnText)
  const previousThreadsFromState = Array.isArray(previousTaskState?.conversationThreads)
    ? previousTaskState.conversationThreads.map(cloneThread).filter(Boolean)
    : []
  const previousThreads =
    previousThreadsFromState.length > 0
      ? previousThreadsFromState
      : (() => {
          const fallbackThread = buildFallbackThreadFromPreviousTaskState(
            previousTaskState,
            tenantTopicTaxonomy,
          )
          return fallbackThread ? [fallbackThread] : []
        })()
  const previousThreadMap = new Map(
    previousThreads.map((entry) => [String(entry.key), cloneThread(entry)]),
  )
  const previousActiveThread =
    typeof previousTaskState?.activeThreadKey === 'string'
      ? previousThreadMap.get(previousTaskState.activeThreadKey) || null
      : null
  const inferredPreviousActiveThread =
    previousActiveThread ||
    (previousThreads.length === 1 ? cloneThread(previousThreads[0]) : null)

  const matches = Array.from(
    new Map(
      [
        ...buildPrioritizedBaseMatches(
          currentTurnText,
          tenantTopicTaxonomy,
          measurementCarrierTerms,
        ),
        ...buildPrioritizedBaseMatches(
          leadText,
          tenantTopicTaxonomy,
          measurementCarrierTerms,
        ),
      ].map((entry) => [`${entry.kind}:${entry.key}:${entry.matchedAlias || entry.label}`, entry]),
    ).values(),
  )
  const baseThreads = []
  const currentThreadMap = new Map()

  const getOrCreateThread = (match) => {
    const thread = createThreadFromMatch(match)
    if (!thread) {
      return null
    }
    const existing =
      currentThreadMap.get(thread.key) ||
      previousThreadMap.get(thread.key) ||
      null
    const next = existing
      ? {
          ...cloneThread(existing),
          baseKey: thread.baseKey,
          baseLabel: thread.baseLabel,
          baseType: thread.baseType,
          familyLabel: thread.familyLabel || existing.familyLabel || null,
          resolvedLabel: existing.resolvedLabel || thread.resolvedLabel,
        }
      : thread
    currentThreadMap.set(thread.key, next)
    return next
  }

  for (const match of matches) {
    if (match.kind === 'product_variant') {
      continue
    }
    const thread = getOrCreateThread(match)
    if (!thread || baseThreads.some((entry) => entry.key === thread.key)) {
      continue
    }
    baseThreads.push(thread)
  }

  for (const match of matches) {
    if (match.kind !== 'product_variant') {
      continue
    }

    const preferredParentKey =
      match.parentKeys.find((entry) => String(entry || '').startsWith('product_topic:')) ||
      match.parentKeys[0] ||
      null
    const preferredThreadKey = preferredParentKey ? buildThreadKey(preferredParentKey) : null
    let targetThread =
      (preferredThreadKey && currentThreadMap.get(preferredThreadKey)) ||
      (preferredThreadKey && previousThreadMap.get(preferredThreadKey)) ||
      null

    if (!targetThread && inferredPreviousActiveThread) {
      const parentKeySet = new Set(Array.isArray(match.parentKeys) ? match.parentKeys : [])
      if (
        parentKeySet.has(inferredPreviousActiveThread.baseKey) ||
        normalizeText(inferredPreviousActiveThread.familyLabel || '') ===
          normalizeText(match.familyLabel || '')
      ) {
        targetThread = cloneThread(inferredPreviousActiveThread)
      }
    }

    if (!targetThread && match.familyLabel) {
      targetThread =
        Array.from(currentThreadMap.values()).find(
          (entry) =>
            normalizeText(entry.familyLabel || '') ===
            normalizeText(match.familyLabel || ''),
        ) || null
    }

    if (!targetThread) {
      targetThread = getOrCreateThread(match)
    }

    if (!targetThread) {
      continue
    }

    const mergedThread = attachVariantToThread(targetThread, match)
    currentThreadMap.set(mergedThread.key, mergedThread)
  }

  const currentThreads = Array.from(currentThreadMap.values())
  const measurementOnlyTurn =
    currentThreads.length === 0 &&
    inferMeasurementOnlyTurn({ currentTurnText, nluAnalysis })
  const activeThreadFromExplicitMatches = selectActiveThreadFromExplicitMatches({
    currentBaseThreads: currentThreads,
    previousActiveThread: inferredPreviousActiveThread,
    normalizedInput,
  })
  const requiresDisambiguation =
    currentThreads.length > 1 && !activeThreadFromExplicitMatches

  let activeThread = null
  if (requiresDisambiguation) {
    activeThread = null
  } else if (activeThreadFromExplicitMatches) {
    activeThread = currentThreadMap.get(activeThreadFromExplicitMatches.key) || activeThreadFromExplicitMatches
  } else if (currentThreads.length === 1) {
    activeThread = currentThreads[0]
  } else if (
    currentThreads.length === 0 &&
    inferredPreviousActiveThread &&
    (measurementOnlyTurn ||
      /^(y|tambien|también|si|sí|con|sin|de|para)\b/.test(normalizedInput))
  ) {
    activeThread = cloneThread(inferredPreviousActiveThread)
  } else if (inferredPreviousActiveThread && currentThreads.length > 1) {
    activeThread =
      currentThreads.find((entry) => entry.key === inferredPreviousActiveThread.key) || null
  }

  if (activeThread && !currentThreadMap.has(activeThread.key)) {
    currentThreadMap.set(activeThread.key, activeThread)
  }

  const mergedThreads = Array.from(
    new Map(
      [...previousThreadMap.values(), ...currentThreadMap.values()].map((entry) => [
        entry.key,
        entry,
      ]),
    ).values(),
  )

  const promptText = requiresDisambiguation
    ? buildDisambiguationPrompt(currentThreads)
    : null
  const switchDetected =
    Boolean(activeThread?.key) &&
    Boolean(inferredPreviousActiveThread?.key) &&
    activeThread.key !== inferredPreviousActiveThread.key

  return {
    threads: mergedThreads,
    activeThreadKey: activeThread?.key || null,
    activeThread: activeThread || null,
    multiTopicDetected: currentThreads.length > 1,
    requiresDisambiguation,
    switchDetected,
    promptText,
    measurementOnlyTurn,
  }
}
