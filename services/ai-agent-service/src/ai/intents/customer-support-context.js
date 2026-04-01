import {
  BASE_CONVERSATIONAL_ES_SIGNALS,
  countStemMatches,
  detectStandaloneAttachmentArtifactKind,
  getDomainSupportSignals,
  hasPhraseMatch,
  normalizeSemanticText,
  tokenizeSemanticText,
} from './customer-semantic-signals.js'
import {
  looksLikeCustomerScheduleAvailabilityRequest,
  looksLikeCustomerSupportComponentReplacementRequest,
  looksLikeCustomerSupportServiceRequest,
} from './customer-operational-heuristics.js'
import { findBestTenantTopicMatch } from './customer-topic-taxonomy.js'

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const normalizeText = normalizeSemanticText
const tokenize = tokenizeSemanticText

const SUPPORT_SIGNAL_SETS = BASE_CONVERSATIONAL_ES_SIGNALS.support

const SUPPORT_PRODUCT_IDENTIFICATION_REGEX =
  /^(?:es|son|tengo|tenemos|seria|sería|es una|es un)\b/iu

const SUPPORT_EXISTING_ITEM_REGEX =
  /\b(existent\w*|instalad\w*|ya\s+instalad\w*|colocad\w*|colocaron|la\s+que\s+tengo|lo\s+que\s+tengo)\b/iu

const SUPPORT_VISIT_SIGNAL_REGEX =
  /\b(visita|coordinar|pasar|venir|domicilio|direccion|dirección|zona|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|mañana|manana|hoy|a las|\d{1,2}:\d{2})\b/iu

const SUPPORT_ISSUE_EXPLICIT_PATTERNS = [
  /\b(no\s+funciona|dejo\s+de\s+funcionar|dej[oó]\s+de\s+funcionar|anda\s+mal|se\s+tranca|se\s+torcio|se\s+torció|se\s+salio|se\s+salió|se\s+rompio|se\s+rompió|se\s+desprendio|se\s+desprendió)\b/iu,
  /\b(repar\w*|service|revisi\w*|ajust\w*|cambi\w*|reemplaz\w*|mover|acortar)\b/iu,
]

const ISSUE_STOP_PATTERNS = [
  /^\s*(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches)\b[\s,.:;-]*/iu,
  /^\s*(si|sí|dale|ok|perfecto|bien)\b[\s,.:;-]*/iu,
]

const formatProductLabel = (value) =>
  compactText(value)
    .replace(/^(?:es|son|una|un|unas|unos)\s+/iu, '')
    .replace(/\s+/g, ' ')

const resolveProductType = ({
  currentTurnText,
  currentTopic = null,
  previousSupportContext = null,
  previousQuoteContext = null,
  tenantTopicTaxonomy = [],
}) => {
  const topicLabel =
    typeof currentTopic?.label === 'string'
      ? currentTopic.label
      : typeof previousSupportContext?.productType === 'string'
        ? previousSupportContext.productType
        : typeof previousQuoteContext?.topicLabel === 'string'
          ? previousQuoteContext.topicLabel
          : typeof previousQuoteContext?.familyLabel === 'string'
            ? previousQuoteContext.familyLabel
            : null

  const source = String(currentTurnText || '')
  const taxonomyMatch = findBestTenantTopicMatch(source, tenantTopicTaxonomy)
  if (taxonomyMatch?.label) {
    return formatProductLabel(taxonomyMatch.label)
  }

  return topicLabel ? formatProductLabel(topicLabel) : null
}

const looksLikeProductIdentificationOnly = ({
  currentTurnText,
  tenantTopicTaxonomy = [],
  currentTopic = null,
  previousSupportContext = null,
  previousQuoteContext = null,
}) => {
  const normalized = normalizeText(currentTurnText)
  if (!normalized) {
    return false
  }

  const hasProductLabel = Boolean(
    resolveProductType({
      currentTurnText,
      currentTopic,
      previousSupportContext,
      previousQuoteContext,
      tenantTopicTaxonomy,
    }),
  )
  const hasExplicitIssue = SUPPORT_ISSUE_EXPLICIT_PATTERNS.some((pattern) =>
    pattern.test(currentTurnText),
  )
  const hasVisitSignal = SUPPORT_VISIT_SIGNAL_REGEX.test(currentTurnText)

  return (
    hasProductLabel &&
    !hasExplicitIssue &&
    !hasVisitSignal &&
    (SUPPORT_PRODUCT_IDENTIFICATION_REGEX.test(normalized) ||
      SUPPORT_EXISTING_ITEM_REGEX.test(normalized))
  )
}

const sanitizeIssueText = (value) => {
  let sanitized = compactText(value)
  for (const pattern of ISSUE_STOP_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }
  return compactText(sanitized)
}

const resolveIssueSummary = ({
  currentTurnText,
  previousSupportContext = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
  currentTopic = null,
  previousQuoteContext = null,
}) => {
  if (detectStandaloneAttachmentArtifactKind(currentTurnText)) {
    return previousSupportContext?.issueSummary || null
  }

  if (
    looksLikeProductIdentificationOnly({
      currentTurnText,
      tenantTopicTaxonomy,
      currentTopic,
      previousSupportContext,
      previousQuoteContext,
    })
  ) {
    return previousSupportContext?.issueSummary || null
  }

  const normalized = normalizeText(currentTurnText)
  if (!normalized) {
    return previousSupportContext?.issueSummary || null
  }

  const tokens = tokenize(normalized)
  const domainSignalSets = getDomainSupportSignals(tenantRuntimePolicy)
  const serviceMatches = countStemMatches(tokens, SUPPORT_SIGNAL_SETS.serviceStems)
  const replacementMatches = countStemMatches(tokens, SUPPORT_SIGNAL_SETS.replacementStems)
  const problemMatches = countStemMatches(tokens, SUPPORT_SIGNAL_SETS.problemStems)
  const componentMatches = countStemMatches(tokens, domainSignalSets.componentStems)
  const hasProblemPhrase = hasPhraseMatch(normalized, SUPPORT_SIGNAL_SETS.problemPhrases)

  const looksLikeIssue =
    SUPPORT_ISSUE_EXPLICIT_PATTERNS.some((pattern) => pattern.test(currentTurnText)) ||
    hasProblemPhrase ||
    serviceMatches >= 1 ||
    replacementMatches >= 1 ||
    problemMatches >= 1 ||
    (componentMatches >= 1 && replacementMatches >= 1)

  if (!looksLikeIssue) {
    return previousSupportContext?.issueSummary || null
  }

  const sanitized = sanitizeIssueText(currentTurnText)
  return sanitized || previousSupportContext?.issueSummary || null
}

const resolveIssueKind = (
  currentTurnText,
  issueSummary = null,
  tenantRuntimePolicy = null,
) => {
  const normalized = normalizeText(currentTurnText || issueSummary)
  if (!normalized) {
    return null
  }

  if (
    looksLikeCustomerSupportComponentReplacementRequest(normalized, {
      tenantRuntimePolicy,
    })
  ) {
    return 'component_replacement'
  }
  if (/\b(repar\w*|service|revisi\w*)\b/u.test(normalized)) {
    return 'technical_review'
  }
  if (/\b(ajust\w*|mover|acortar)\b/u.test(normalized)) {
    return 'adjustment'
  }
  if (/\b(no\s+funciona|anda\s+mal|se\s+tranca|se\s+rompio|se\s+rompió|se\s+salio|se\s+salió)\b/u.test(normalized)) {
    return 'operational_problem'
  }

  return 'support_request'
}

const buildMissingFields = ({
  productType,
  issueSummary,
  wantsVisit,
  preferredDate,
  preferredTime,
  address,
  contactPhone,
  contactEmail,
}) => {
  const missing = []

  if (!productType) {
    missing.push('product')
  }
  if (!issueSummary) {
    missing.push('issue')
  }

  if (wantsVisit) {
    if (!preferredDate) {
      missing.push('date')
    }
    if (!preferredTime) {
      missing.push('time')
    }
    if (!address) {
      missing.push('address')
    }
    if (!contactPhone && !contactEmail) {
      missing.push('contact')
    }
  }

  return missing
}

export const buildCustomerSupportContext = ({
  currentTurnText,
  previousSupportContext = null,
  previousScheduleContext = null,
  currentScheduleContext = null,
  currentTopic = null,
  previousQuoteContext = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
}) => {
  const previous =
    previousSupportContext && typeof previousSupportContext === 'object'
      ? previousSupportContext
      : null
  const scheduleContext =
    currentScheduleContext && typeof currentScheduleContext === 'object'
      ? currentScheduleContext
      : previousScheduleContext && typeof previousScheduleContext === 'object'
        ? previousScheduleContext
        : null

  const productType = resolveProductType({
    currentTurnText,
    currentTopic,
    previousSupportContext: previous,
    previousQuoteContext,
    tenantTopicTaxonomy,
  })
  const issueSummary = resolveIssueSummary({
    currentTurnText,
    previousSupportContext: previous,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
    currentTopic,
    previousQuoteContext,
  })
  const issueKind = resolveIssueKind(
    currentTurnText,
    issueSummary || previous?.issueSummary,
    tenantRuntimePolicy,
  )
  const wantsVisit = Boolean(
    looksLikeCustomerScheduleAvailabilityRequest(currentTurnText, {
      tenantRuntimePolicy,
    }) ||
      SUPPORT_VISIT_SIGNAL_REGEX.test(String(currentTurnText || '')) ||
      scheduleContext ||
      previous?.wantsVisit,
  )
  const address =
    typeof scheduleContext?.address === 'string'
      ? scheduleContext.address
      : typeof previous?.address === 'string'
        ? previous.address
        : null
  const contactPhone =
    typeof scheduleContext?.contactPhone === 'string'
      ? scheduleContext.contactPhone
      : typeof previous?.contactPhone === 'string'
        ? previous.contactPhone
        : null
  const contactEmail =
    typeof scheduleContext?.contactEmail === 'string'
      ? scheduleContext.contactEmail
      : typeof previous?.contactEmail === 'string'
        ? previous.contactEmail
        : null
  const preferredDate =
    scheduleContext?.date && typeof scheduleContext.date === 'object'
      ? scheduleContext.date
      : previous?.preferredDate && typeof previous.preferredDate === 'object'
        ? previous.preferredDate
        : null
  const preferredTime =
    scheduleContext?.time && typeof scheduleContext.time === 'object'
      ? scheduleContext.time
      : previous?.preferredTime && typeof previous.preferredTime === 'object'
        ? previous.preferredTime
        : null
  const missingFields = buildMissingFields({
    productType,
    issueSummary,
    wantsVisit,
    preferredDate,
    preferredTime,
    address,
    contactPhone,
    contactEmail,
  })

  let stage = 'intake'
  let completionStatus = 'needs_info'

  if (productType && !issueSummary) {
    stage = 'product_identified'
  } else if (productType && issueSummary) {
    stage = wantsVisit ? 'visit_intake' : 'issue_defined'
  }

  if (
    wantsVisit &&
    missingFields.every((field) => !['date', 'time', 'address', 'contact'].includes(field))
  ) {
    stage = 'ready_to_schedule'
  }

  if (missingFields.length === 0) {
    completionStatus = wantsVisit ? 'ready_to_schedule' : 'issue_defined'
  } else if (!productType || !issueSummary) {
    completionStatus = 'needs_context'
  }

  return {
    productType: productType || null,
    issueSummary: issueSummary || null,
    issueKind,
    wantsVisit,
    address: address || null,
    contactPhone: contactPhone || null,
    contactEmail: contactEmail || null,
    preferredDate,
    preferredTime,
    missingFields,
    stage,
    completionStatus,
    existingInstallation:
      SUPPORT_EXISTING_ITEM_REGEX.test(String(currentTurnText || '')) ||
      previous?.existingInstallation === true ||
      looksLikeCustomerSupportServiceRequest(String(currentTurnText || ''), {
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
      }),
  }
}
