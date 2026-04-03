import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'
import {
  extractCurrentCustomerTurnText,
  normalizeSemanticCustomerTurnText,
} from '../ingress/customer-turn-normalization.js'
import { buildSemanticTurnSubject } from './semantic-turn-subject.js'

const normalizeText = (value) => normalizeSemanticCustomerTurnText(value)
const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const BASE_LANGUAGE_POLICY = getStaticLanguagePolicy('es-default')
const BASE_SEMANTIC_INFO_POLICY =
  BASE_LANGUAGE_POLICY.semanticInfoIntent &&
  typeof BASE_LANGUAGE_POLICY.semanticInfoIntent === 'object'
    ? BASE_LANGUAGE_POLICY.semanticInfoIntent
    : {}
const BASE_SEMANTIC_INFO_SHAPES =
  BASE_SEMANTIC_INFO_POLICY.shapes &&
  typeof BASE_SEMANTIC_INFO_POLICY.shapes === 'object'
    ? BASE_SEMANTIC_INFO_POLICY.shapes
    : {}
const BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY =
  BASE_SEMANTIC_INFO_POLICY.subjectReference &&
  typeof BASE_SEMANTIC_INFO_POLICY.subjectReference === 'object'
    ? BASE_SEMANTIC_INFO_POLICY.subjectReference
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

const readShapePatterns = ({ semanticKey, fallbackFlags }) =>
  compileRegexList(BASE_SEMANTIC_INFO_SHAPES[semanticKey]?.patterns, fallbackFlags)

const readShapeTerms = (semanticKey) =>
  (Array.isArray(BASE_SEMANTIC_INFO_SHAPES[semanticKey]?.terms)
    ? BASE_SEMANTIC_INFO_SHAPES[semanticKey].terms
    : []
  )
    .map((entry) => normalizeText(entry))
    .filter(Boolean)

const INFO_SHAPE_PATTERNS = {
  variant_discovery: readShapePatterns({
    semanticKey: 'variant_discovery',
    fallbackFlags: 'i',
  }),
  comparison: readShapePatterns({
    semanticKey: 'comparison',
    fallbackFlags: 'iu',
  }),
  definition: readShapePatterns({
    semanticKey: 'definition',
    fallbackFlags: 'i',
  }),
  benefits: readShapePatterns({
    semanticKey: 'benefits',
    fallbackFlags: 'i',
  }),
  general_info: readShapePatterns({
    semanticKey: 'general_info',
    fallbackFlags: 'iu',
  }),
}

const GENERAL_INFO_TERMS = readShapeTerms('general_info')

const CONTEXT_CARRY_SHAPES = new Set(
  Array.isArray(BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.contextCarryShapes)
    ? BASE_SEMANTIC_SUBJECT_REFERENCE_POLICY.contextCarryShapes
    : ['variant_discovery', 'comparison', 'definition', 'benefits', 'general_info'],
)

const SHAPE_PRIORITY = [
  'comparison',
  'variant_discovery',
  'definition',
  'benefits',
  'general_info',
]

const INFO_SHAPE_TO_FAQ_SUBTYPE = {
  comparison: 'variants',
  variant_discovery: 'variants',
  definition: 'definition',
  benefits: 'benefits',
  general_info: 'general',
  unknown: null,
}

const hasGeneralInfoSignal = (normalizedInput) =>
  INFO_SHAPE_PATTERNS.general_info.some((pattern) => pattern.test(normalizedInput)) ||
  GENERAL_INFO_TERMS.some((term) => normalizedInput.includes(term))

export const semanticInfoShapeToFaqSubtype = (shape) =>
  INFO_SHAPE_TO_FAQ_SUBTYPE[String(shape || 'unknown')] || null

export const detectInfoRequestShape = (input) => {
  const currentTurnText = extractCurrentCustomerTurnText(input)
  const normalizedInput = normalizeText(currentTurnText)
  if (!normalizedInput) {
    return 'unknown'
  }

  for (const shape of SHAPE_PRIORITY) {
    if (shape === 'general_info') {
      continue
    }

    if (INFO_SHAPE_PATTERNS[shape].some((pattern) => pattern.test(normalizedInput))) {
      return shape
    }
  }

  if (hasGeneralInfoSignal(normalizedInput)) {
    return 'general_info'
  }

  return 'unknown'
}

export const buildSemanticInfoIntent = ({
  input,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
  contextTopic = null,
  previousQuoteContext = null,
  followUpDetected = false,
}) => {
  const currentTurnText = extractCurrentCustomerTurnText(input)
  const shape = detectInfoRequestShape(currentTurnText)
  const semanticTurnSubject = buildSemanticTurnSubject({
    input: currentTurnText,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
    contextTopic,
    previousQuoteContext,
    followUpDetected,
    shape,
    allowContextCarry: true,
    contextCarryShapes: CONTEXT_CARRY_SHAPES,
  })
  const subjectMode = semanticTurnSubject.subjectMode
  const subjectResolution = semanticTurnSubject.subjectResolution
  const subject = semanticTurnSubject.subject
  const shouldSuppressRequestedTopicLabel =
    semanticTurnSubject.suppressed ||
    (shape !== 'unknown' && subjectMode !== 'explicit')
  const needsSubjectFromContext = subjectMode === 'implicit_from_context'
  const shouldStayInActiveThread =
    Boolean(semanticTurnSubject.contextSubject?.label) &&
    (needsSubjectFromContext ||
      (shape !== 'unknown' && followUpDetected && subjectMode !== 'explicit'))

  return {
    shape,
    subjectMode,
    subjectResolution,
    subject,
    comparisonRequested: shape === 'comparison',
    needsSubjectFromContext,
    shouldSuppressRequestedTopicLabel,
    shouldStayInActiveThread,
  }
}
