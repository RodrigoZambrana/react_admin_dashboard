import { extractCustomerQuotedMeasurements, extractCustomerQuoteLeadText } from './customer-quote-context.js'
import { findTenantTopicMatches, normalizeCustomerTopicText } from './customer-topic-taxonomy.js'

const normalizeText = normalizeCustomerTopicText

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const dedupe = (values = []) => Array.from(new Set(values.filter(Boolean)))

const normalizeCarrierTerms = (terms = []) =>
  Array.isArray(terms)
    ? dedupe(terms.map((entry) => normalizeText(entry)).filter(Boolean))
    : []

const buildThreadKey = (baseKey) => `thread:${String(baseKey || '').trim()}`

const createThreadFromMatch = (match) => {
  if (!match?.key || !match?.label) {
    return null
  }

  const baseType = match.kind === 'product_variant' ? 'product_topic' : match.kind
  const baseLabel =
    match.kind === 'product_variant'
      ? match.parentLabels.find(Boolean) || match.familyLabel || match.label
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
  nextThread.displayLabel = compactText(
    [nextThread.baseLabel, variantPhrase].filter(Boolean).join(' '),
  )
  nextThread.resolvedLabel = compactText(
    [nextThread.baseLabel, canonicalVariantPhrase].filter(Boolean).join(' '),
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

const buildPrioritizedBaseMatches = (leadText, taxonomy = [], measurementCarrierTerms = []) => {
  const matches = findTenantTopicMatches(leadText, taxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
    limit: 12,
  })
  const carriers = new Set(normalizeCarrierTerms(measurementCarrierTerms))
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
          normalizeText(entry.familyLabel || '') === normalizeText(match.label),
      )
    ) {
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
  const previousThreads = Array.isArray(previousTaskState?.conversationThreads)
    ? previousTaskState.conversationThreads.map(cloneThread).filter(Boolean)
    : []
  const previousThreadMap = new Map(
    previousThreads.map((entry) => [String(entry.key), cloneThread(entry)]),
  )
  const previousActiveThread =
    typeof previousTaskState?.activeThreadKey === 'string'
      ? previousThreadMap.get(previousTaskState.activeThreadKey) || null
      : null

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

    if (!targetThread && previousActiveThread) {
      const parentKeySet = new Set(Array.isArray(match.parentKeys) ? match.parentKeys : [])
      if (
        parentKeySet.has(previousActiveThread.baseKey) ||
        normalizeText(previousActiveThread.familyLabel || '') ===
          normalizeText(match.familyLabel || '')
      ) {
        targetThread = cloneThread(previousActiveThread)
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
    previousActiveThread,
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
    previousActiveThread &&
    (measurementOnlyTurn ||
      /^(y|tambien|también|si|sí|con|sin|de|para)\b/.test(normalizedInput))
  ) {
    activeThread = cloneThread(previousActiveThread)
  } else if (previousActiveThread && currentThreads.length > 1) {
    activeThread =
      currentThreads.find((entry) => entry.key === previousActiveThread.key) || null
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
    Boolean(previousActiveThread?.key) &&
    activeThread.key !== previousActiveThread.key

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
