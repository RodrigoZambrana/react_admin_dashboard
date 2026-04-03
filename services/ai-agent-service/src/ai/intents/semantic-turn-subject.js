import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'
import {
  extractCurrentCustomerTurnText,
  extractSemanticCustomerTurnText,
  normalizeSemanticCustomerTurnText,
} from '../ingress/customer-turn-normalization.js'
import {
  detectStandaloneAttachmentArtifactKind,
  hasQuantityOnlyFollowUpSignal,
  hasReengagementReferenceSignal,
} from './customer-semantic-signals.js'
import {
  looksLikePaymentOperationalUpdate,
  looksLikeQuoteRequirementsQuestion,
} from './customer-intent-patterns.js'
import {
  findBestTenantTopicMatch,
  findTenantTopicMatches,
  isContextualTopicDescriptorMatch,
} from './customer-topic-taxonomy.js'
import { getVocabulary } from '../tenant-policy/runtime-tenant-policy.js'
import { isGenericQuoteTopicLabel } from './quote-semantics.js'

const normalizeText = (value) => normalizeSemanticCustomerTurnText(value)
const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const BASE_LANGUAGE_POLICY = getStaticLanguagePolicy('es-default')
const BASE_SEMANTIC_INFO_POLICY =
  BASE_LANGUAGE_POLICY.semanticInfoIntent &&
  typeof BASE_LANGUAGE_POLICY.semanticInfoIntent === 'object'
    ? BASE_LANGUAGE_POLICY.semanticInfoIntent
    : {}
const BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY =
  BASE_SEMANTIC_INFO_POLICY.subjectReference &&
  typeof BASE_SEMANTIC_INFO_POLICY.subjectReference === 'object'
    ? BASE_SEMANTIC_INFO_POLICY.subjectReference
    : {}
const BASE_SEMANTIC_TURN_SUBJECT_POLICY =
  BASE_LANGUAGE_POLICY.semanticTurnSubject &&
  typeof BASE_LANGUAGE_POLICY.semanticTurnSubject === 'object'
    ? BASE_LANGUAGE_POLICY.semanticTurnSubject
    : {}

const compileRegex = (entry, fallbackFlags = 'u') => {
  if (!entry || typeof entry !== 'object' || typeof entry.source !== 'string') {
    return null
  }

  return new RegExp(entry.source, entry.flags || fallbackFlags)
}

const compileRegexList = (entries = [], fallbackFlags = 'u') =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => compileRegex(entry, fallbackFlags))
    .filter(Boolean)

const compilePatternEntries = (entries = [], fallbackFlags = 'u') =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const regex = compileRegex(entry, fallbackFlags)
      if (!regex) {
        return null
      }

      return {
        regex,
        intentBias:
          typeof entry?.intentBias === 'string' && entry.intentBias.trim()
            ? entry.intentBias.trim()
            : null,
      }
    })
    .filter(Boolean)

const WEB_LEAD_INTRO_PREFIX_REGEX = compileRegex(
  BASE_LANGUAGE_POLICY.webLeadIntroPattern,
  'u',
)

const stripWebLeadIntro = (value = '') => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }

  const prefixMatch = normalized.match(WEB_LEAD_INTRO_PREFIX_REGEX)
  if (!prefixMatch) {
    return normalized
  }

  const remainder = normalized.slice(prefixMatch[0].length).trim()
  return remainder || normalized
}

const tokenizeNormalizedText = (value) =>
  normalizeText(value)
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean)

const singularizeToken = (token) => {
  const normalized = normalizeText(token)
  if (!normalized) {
    return ''
  }
  if (normalized.endsWith('s') && normalized.length > 3) {
    return normalized.slice(0, -1)
  }
  return normalized
}

const buildTokenForms = (token) =>
  Array.from(
    new Set(
      [
        normalizeText(token),
        singularizeToken(token),
        normalizeText(token).endsWith('es') && normalizeText(token).length > 4
          ? normalizeText(token).slice(0, -2)
          : '',
      ].filter(Boolean),
    ),
  )

const CONTEXT_CARRY_SHAPES = new Set(
  Array.isArray(BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.contextCarryShapes)
    ? BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.contextCarryShapes
    : ['variant_discovery', 'comparison', 'definition', 'benefits', 'general_info'],
)

const GENERIC_DESCRIPTOR_TOKENS = new Set(
  (Array.isArray(BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.genericDescriptorTokens)
    ? BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.genericDescriptorTokens
    : []
  )
    .map((entry) => normalizeText(entry))
    .filter(Boolean),
)

const GENERIC_DESCRIPTOR_IGNORED_TOKENS = new Set(
  (Array.isArray(BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.genericDescriptorIgnoredTokens)
    ? BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.genericDescriptorIgnoredTokens
    : []
  )
    .map((entry) => normalizeText(entry))
    .filter(Boolean),
)

const SUBJECT_CAPTURE_PATTERNS = compilePatternEntries(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.capturePatterns,
  'iu',
)

const QUOTE_EXPANSION_PATTERNS = compilePatternEntries(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.quoteExpansionPatterns,
  'iu',
)

const LEADING_STRIP_PATTERNS = compileRegexList(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.leadingStripPatterns,
  'iu',
)

const TRAILING_STRIP_PATTERNS = compileRegexList(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.trailingStripPatterns,
  'iu',
)

const GENERIC_SUBJECT_PATTERNS = compileRegexList(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.genericSubjectPatterns,
  'iu',
)

const MESSAGE_PLACEHOLDER_PATTERNS = compileRegexList(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.messagePlaceholderPatterns,
  'iu',
)

const SCHEDULE_ACTION_PATTERNS = compileRegexList(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.scheduleAvailabilityActionPatterns,
  'iu',
)

const SCHEDULE_TIME_PATTERNS = compileRegexList(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.scheduleAvailabilityTimePatterns,
  'iu',
)

const SHORT_FOLLOW_UP_PATTERN = compileRegex(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.shortFollowUpPattern,
  'iu',
)

const SHORT_FOLLOW_UP_BLOCKED_PATTERNS = compileRegexList(
  BASE_SEMANTIC_TURN_SUBJECT_POLICY.shortFollowUpBlockedPatterns,
  'iu',
)

const EDGE_STOPWORDS = new Set(
  (Array.isArray(BASE_SEMANTIC_TURN_SUBJECT_POLICY.edgeStopwords)
    ? BASE_SEMANTIC_TURN_SUBJECT_POLICY.edgeStopwords
    : []
  )
    .map((entry) => normalizeText(entry))
    .filter(Boolean),
)

const getVariantContextTerms = (tenantRuntimePolicy = null) =>
  (getVocabulary(tenantRuntimePolicy)?.variantContextTerms ?? [])
    .flatMap((entry) => normalizeText(entry).split(/\s+/u))
    .filter(Boolean)

const buildSubjectDescriptor = (input = {}, sourceOverride = null) => {
  const label = compactText(input?.label || '')
  if (!label || isGenericQuoteTopicLabel(label)) {
    return null
  }

  return {
    label,
    type: typeof input?.type === 'string' ? input.type : 'product_topic',
    confidence:
      typeof input?.confidence === 'number' && Number.isFinite(input.confidence)
        ? input.confidence
        : 0.72,
    intentBias:
      typeof input?.intentBias === 'string' && input.intentBias.trim()
        ? input.intentBias.trim()
        : null,
    source: sourceOverride || input?.source || 'semantic_turn_subject',
  }
}

const buildSubjectFromTopicMatch = (match, source = 'semantic_subject_match') => {
  if (!match?.label) {
    return null
  }

  return buildSubjectDescriptor(
    {
      label: match.label,
      type: match.kind || 'product_topic',
      confidence: 0.9,
      source,
    },
    source,
  )
}

export const isGenericSemanticDescriptorLabel = (value) => {
  const tokens = tokenizeNormalizedText(value).filter(
    (token) => !GENERIC_DESCRIPTOR_IGNORED_TOKENS.has(token),
  )

  if (!tokens.length) {
    return false
  }

  return tokens.every((token) =>
    buildTokenForms(token).some((candidate) =>
      GENERIC_DESCRIPTOR_TOKENS.has(candidate),
    ),
  )
}

export const isGenericSemanticSubjectLabel = (value) =>
  isGenericQuoteTopicLabel(value) ||
  isGenericSemanticDescriptorLabel(value) ||
  GENERIC_SUBJECT_PATTERNS.some((pattern) => pattern.test(compactText(value || '')))

const normalizeSemanticSubjectCandidate = (value) => {
  let candidate = compactText(value)
  if (!candidate) {
    return null
  }

  for (const pattern of LEADING_STRIP_PATTERNS) {
    candidate = compactText(candidate.replace(pattern, ''))
  }

  for (const pattern of TRAILING_STRIP_PATTERNS) {
    candidate = compactText(candidate.replace(pattern, ''))
  }

  const tokens = candidate
    .split(/\s+/u)
    .map((entry) => normalizeText(entry))
    .filter(Boolean)

  while (tokens.length > 0 && EDGE_STOPWORDS.has(tokens[0])) {
    tokens.shift()
  }
  while (tokens.length > 0 && EDGE_STOPWORDS.has(tokens[tokens.length - 1])) {
    tokens.pop()
  }

  const normalizedCandidate = compactText(tokens.join(' '))
  if (!normalizedCandidate || isGenericSemanticSubjectLabel(normalizedCandidate)) {
    return null
  }

  return normalizedCandidate
}

const extractPatternCandidates = (input, patterns = []) => {
  const candidates = []
  for (const patternEntry of patterns) {
    const match = input.match(patternEntry.regex)
    if (!match?.[1]) {
      continue
    }

    const candidate = normalizeSemanticSubjectCandidate(match[1])
    if (candidate) {
      candidates.push({
        label: candidate,
        intentBias: patternEntry.intentBias,
        allowFreeform: true,
      })
    }
  }

  return candidates
}

const extractShortFollowUpCandidate = (semanticInput) => {
  if (!SHORT_FOLLOW_UP_PATTERN) {
    return null
  }

  const match = semanticInput.match(SHORT_FOLLOW_UP_PATTERN)
  if (!match?.[1]) {
    return null
  }

  const candidate = normalizeSemanticSubjectCandidate(match[1])
  if (!candidate) {
    return null
  }

  if (SHORT_FOLLOW_UP_BLOCKED_PATTERNS.some((pattern) => pattern.test(candidate))) {
    return null
  }

  return {
    label: candidate,
    intentBias: null,
    allowFreeform: true,
  }
}

const hasScheduleAvailabilityPayload = (semanticInput) =>
  SCHEDULE_ACTION_PATTERNS.some((pattern) => pattern.test(semanticInput)) &&
  SCHEDULE_TIME_PATTERNS.some((pattern) => pattern.test(semanticInput))

const shouldSuppressExplicitSubjectExtraction = ({
  input,
  currentInput,
  semanticInput,
}) => {
  if (!semanticInput) {
    return {
      suppressed: true,
      reason: 'empty_input',
    }
  }

  if (
    detectStandaloneAttachmentArtifactKind(input) ||
    detectStandaloneAttachmentArtifactKind(currentInput)
  ) {
    return {
      suppressed: true,
      reason: 'attachment_artifact',
    }
  }

  if (MESSAGE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(semanticInput))) {
    return {
      suppressed: true,
      reason: 'message_placeholder',
    }
  }

  if (hasScheduleAvailabilityPayload(semanticInput)) {
    return {
      suppressed: true,
      reason: 'schedule_payload',
    }
  }

  if (hasQuantityOnlyFollowUpSignal(semanticInput)) {
    return {
      suppressed: true,
      reason: 'quantity_only_follow_up',
    }
  }

  if (hasReengagementReferenceSignal(currentInput)) {
    return {
      suppressed: true,
      reason: 'reengagement_reference',
    }
  }

  if (looksLikeQuoteRequirementsQuestion(semanticInput)) {
    return {
      suppressed: true,
      reason: 'quote_requirements',
    }
  }

  if (looksLikePaymentOperationalUpdate(semanticInput)) {
    return {
      suppressed: true,
      reason: 'payment_operational_update',
    }
  }

  return {
    suppressed: false,
    reason: null,
  }
}

const selectExplicitSubjectMatchFromValue = (
  value,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
) => {
  const matches = findTenantTopicMatches(value, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
    limit: 6,
    variantContextTerms: getVariantContextTerms(tenantRuntimePolicy),
  })

  if (!matches.length) {
    return null
  }

  const filteredMatches = matches.filter(
    (match) => !isContextualTopicDescriptorMatch(match, value),
  )
  const candidatePool = filteredMatches.length > 0 ? filteredMatches : matches

  return (
    candidatePool.find((match) => match.kind === 'product_topic') ||
    candidatePool.find((match) => match.kind === 'product_variant') ||
    candidatePool[0] ||
    null
  )
}

export const resolveContextSubject = ({
  contextTopic = null,
  previousQuoteContext = null,
  tenantTopicTaxonomy = [],
}) => {
  const topicCandidate = buildSubjectDescriptor(
    contextTopic,
    contextTopic?.source || 'conversation_memory',
  )
  if (topicCandidate) {
    return topicCandidate
  }

  const fallbackLabel =
    compactText(previousQuoteContext?.topicLabel || '') ||
    compactText(previousQuoteContext?.familyLabel || '')
  if (!fallbackLabel || isGenericQuoteTopicLabel(fallbackLabel)) {
    return null
  }

  const topicMatch = findBestTenantTopicMatch(fallbackLabel, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
  })

  return buildSubjectDescriptor(
    {
      label: fallbackLabel,
      type:
        typeof previousQuoteContext?.topicType === 'string'
          ? previousQuoteContext.topicType
          : topicMatch?.kind ||
            (compactText(previousQuoteContext?.familyLabel || '') === fallbackLabel
              ? 'product_family'
              : 'product_topic'),
      confidence: 0.68,
      source: 'quote_memory',
    },
    'quote_memory',
  )
}

export const extractExplicitSemanticSubject = ({
  input,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
}) => {
  const currentInput = extractCurrentCustomerTurnText(input)
  const semanticInput = stripWebLeadIntro(extractSemanticCustomerTurnText(input))
  const suppression = shouldSuppressExplicitSubjectExtraction({
    input,
    currentInput,
    semanticInput,
  })

  if (suppression.suppressed) {
    return {
      explicitSubject: null,
      suppressed: true,
      suppressionReason: suppression.reason,
      candidates: [],
    }
  }

  const candidateEntries = []
  const pushCandidate = (entry) => {
    if (!entry?.label) {
      return
    }
    if (
      candidateEntries.some(
        (candidate) => normalizeText(candidate.label) === normalizeText(entry.label),
      )
    ) {
      return
    }
    candidateEntries.push(entry)
  }

  pushCandidate({
    label: normalizeSemanticSubjectCandidate(semanticInput),
    intentBias: null,
    allowFreeform: false,
  })
  extractPatternCandidates(semanticInput, SUBJECT_CAPTURE_PATTERNS).forEach(pushCandidate)
  extractPatternCandidates(semanticInput, QUOTE_EXPANSION_PATTERNS).forEach(pushCandidate)
  pushCandidate(extractShortFollowUpCandidate(semanticInput))

  for (const candidateEntry of candidateEntries) {
    const candidateText = candidateEntry.label
    const match = selectExplicitSubjectMatchFromValue(
      candidateText,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
    )
    if (!match?.label) {
      continue
    }

    return {
      explicitSubject: buildSubjectFromTopicMatch(
        {
          ...match,
          intentBias: candidateEntry.intentBias,
        },
        normalizeText(candidateText) === normalizeText(semanticInput)
          ? 'semantic_direct_subject'
          : 'semantic_candidate_subject',
      ),
      suppressed: false,
      suppressionReason: null,
      candidates: candidateEntries.map((entry) => entry.label),
    }
  }

  const freeformCandidate =
    candidateEntries.find((entry) => entry.label && entry.allowFreeform) || null
  if (freeformCandidate?.label) {
    return {
      explicitSubject: buildSubjectDescriptor(
        {
          label: freeformCandidate.label,
          type:
            freeformCandidate.intentBias === 'topic_info'
              ? 'product_family_candidate'
              : 'product_topic_candidate',
          confidence: 0.58,
          intentBias: freeformCandidate.intentBias,
          source: 'semantic_freeform_subject',
        },
        'semantic_freeform_subject',
      ),
      suppressed: false,
      suppressionReason: null,
      candidates: candidateEntries.map((entry) => entry.label),
    }
  }

  return {
    explicitSubject: null,
    suppressed: false,
    suppressionReason: null,
    candidates: candidateEntries.map((entry) => entry.label),
  }
}

export const detectSemanticSubjectReferenceMode = ({
  explicitSubject = null,
  contextSubject = null,
  followUpDetected = false,
  shape = 'unknown',
  allowContextCarry = false,
  contextCarryShapes = CONTEXT_CARRY_SHAPES,
}) => {
  if (explicitSubject?.label) {
    return 'explicit'
  }

  if (
    allowContextCarry &&
    shape !== 'unknown' &&
    contextCarryShapes.has(shape) &&
    contextSubject?.label &&
    followUpDetected
  ) {
    return 'implicit_from_context'
  }

  return 'none'
}

export const resolveSemanticTurnSubject = ({
  explicitSubject = null,
  contextSubject = null,
  referenceMode = 'none',
}) => {
  if (referenceMode === 'explicit' && explicitSubject?.label) {
    return {
      subjectResolution: 'resolved_subject',
      subject: explicitSubject,
    }
  }

  if (referenceMode === 'implicit_from_context' && contextSubject?.label) {
    return {
      subjectResolution: 'inherit_subject',
      subject: buildSubjectDescriptor(contextSubject, 'semantic_context_inheritance'),
    }
  }

  return {
    subjectResolution: 'unresolved',
    subject: null,
  }
}

export const buildSemanticTurnSubject = ({
  input,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
  contextTopic = null,
  previousQuoteContext = null,
  followUpDetected = false,
  shape = 'unknown',
  allowContextCarry = false,
  contextCarryShapes = CONTEXT_CARRY_SHAPES,
}) => {
  const {
    explicitSubject,
    suppressed,
    suppressionReason,
    candidates,
  } = extractExplicitSemanticSubject({
    input,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
  })
  const contextSubject = resolveContextSubject({
    contextTopic,
    previousQuoteContext,
    tenantTopicTaxonomy,
  })
  const subjectMode = detectSemanticSubjectReferenceMode({
    explicitSubject,
    contextSubject,
    followUpDetected,
    shape,
    allowContextCarry,
    contextCarryShapes,
  })
  const { subjectResolution, subject } = resolveSemanticTurnSubject({
    explicitSubject,
    contextSubject,
    referenceMode: subjectMode,
  })

  return {
    explicitSubject,
    contextSubject,
    subjectMode,
    subjectResolution,
    subject,
    suppressed,
    suppressionReason,
    candidates,
  }
}
