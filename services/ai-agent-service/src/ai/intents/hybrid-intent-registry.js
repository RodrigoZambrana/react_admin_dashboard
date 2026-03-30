const normalizeComparableText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const tokenizeComparableText = (value) =>
  normalizeComparableText(value)
    .split(' ')
    .filter((token) => token.length >= 3)

const similarityScore = (left, right) => {
  const leftTokens = tokenizeComparableText(left)
  const rightTokens = tokenizeComparableText(right)
  if (!leftTokens.length || !rightTokens.length) {
    return 0
  }

  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  let intersection = 0
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1
    }
  }

  return intersection / Math.max(leftSet.size, rightSet.size)
}

const normalizeStringArray = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? [normalized] : []
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const normalizeRegexArray = (value) =>
  normalizeStringArray(value)
    .map((entry) => {
      try {
        return new RegExp(entry, 'i')
      } catch {
        return null
      }
    })
    .filter(Boolean)

const buildNormalizedIntentRule = (rawRule, index) => {
  if (!isPlainObject(rawRule)) {
    return null
  }

  const id =
    typeof rawRule.id === 'string' && rawRule.id.trim()
      ? rawRule.id.trim()
      : `runtime_rule_${index + 1}`
  const intent =
    typeof rawRule.intent === 'string' && rawRule.intent.trim()
      ? rawRule.intent.trim()
      : null
  if (!intent) {
    return null
  }

  const examples = normalizeStringArray(rawRule.examples)
  const includesAny = normalizeStringArray(rawRule.includesAny).map(normalizeComparableText)
  const includesAll = normalizeStringArray(rawRule.includesAll).map(normalizeComparableText)
  const regexAny = normalizeRegexArray(rawRule.regexAny)
  const regexAll = normalizeRegexArray(rawRule.regexAll)
  const priority = Number.isFinite(Number(rawRule.priority))
    ? Number(rawRule.priority)
    : 50
  const confidence =
    Number.isFinite(Number(rawRule.confidence)) && Number(rawRule.confidence) >= 0
      ? Math.max(0, Math.min(1, Number(rawRule.confidence)))
      : 0.84

  if (
    !examples.length &&
    !includesAny.length &&
    !includesAll.length &&
    !regexAny.length &&
    !regexAll.length
  ) {
    return null
  }

  return {
    id,
    intent,
    priority,
    confidence,
    examples,
    includesAny,
    includesAll,
    regexAny,
    regexAll,
    decisionPath:
      Array.isArray(rawRule.decisionPath) && rawRule.decisionPath.length
        ? rawRule.decisionPath.filter((entry) => typeof entry === 'string' && entry.trim())
        : [`runtime:customer_hybrid_intent_registry:${id}`],
  }
}

export const normalizeCustomerHybridIntentRegistry = (value) => {
  if (!value) {
    return []
  }

  const rawRules = Array.isArray(value)
    ? value
    : Array.isArray(value?.rules)
      ? value.rules
      : []

  return rawRules
    .map((entry, index) => buildNormalizedIntentRule(entry, index))
    .filter(Boolean)
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
}

const evaluateHybridIntentRule = (rule, { normalizedInput, normalizedReasoningInput }) => {
  let score = 0

  if (rule.includesAny.some((entry) => normalizedReasoningInput.includes(entry))) {
    score += 2
  }
  if (
    rule.includesAll.length &&
    rule.includesAll.every((entry) => normalizedReasoningInput.includes(entry))
  ) {
    score += 3
  }
  if (rule.regexAny.some((pattern) => pattern.test(normalizedReasoningInput))) {
    score += 3
  }
  if (
    rule.regexAll.length &&
    rule.regexAll.every((pattern) => pattern.test(normalizedReasoningInput))
  ) {
    score += 4
  }

  const bestExampleScore = rule.examples.reduce((best, example) => {
    const nextScore = Math.max(
      similarityScore(example, normalizedInput),
      similarityScore(example, normalizedReasoningInput),
    )
    return Math.max(best, nextScore)
  }, 0)

  if (bestExampleScore >= 0.8) {
    score += 4
  } else if (bestExampleScore >= 0.62) {
    score += 3
  } else if (bestExampleScore >= 0.5) {
    score += 1
  }

  if (score <= 0) {
    return null
  }

  return {
    rule,
    totalScore: Number(rule.priority || 0) * 100 + score * 10 + Math.round(bestExampleScore * 10),
  }
}

export const matchCustomerHybridIntentRegistry = ({
  registry = null,
  input,
  reasoningInput = null,
}) => {
  const normalizedRegistry = normalizeCustomerHybridIntentRegistry(registry)
  if (!normalizedRegistry.length) {
    return null
  }

  const normalizedInput = normalizeComparableText(input)
  const normalizedReasoningInput = normalizeComparableText(
    reasoningInput == null ? input : reasoningInput,
  )

  let bestMatch = null
  for (const rule of normalizedRegistry) {
    const evaluated = evaluateHybridIntentRule(rule, {
      normalizedInput,
      normalizedReasoningInput,
    })
    if (!evaluated) {
      continue
    }
    if (!bestMatch || evaluated.totalScore > bestMatch.totalScore) {
      bestMatch = evaluated
    }
  }

  if (!bestMatch) {
    return null
  }

  return {
    intent: bestMatch.rule.intent,
    confidence: bestMatch.rule.confidence,
    keywords: [`runtime_${bestMatch.rule.id}`],
    decisionPath: bestMatch.rule.decisionPath,
    ruleId: bestMatch.rule.id,
    examples: bestMatch.rule.examples.slice(0, 3),
  }
}

export const collectCustomerHybridIntentHints = ({
  registry = null,
  input,
  reasoningInput = null,
  limit = 3,
}) => {
  const normalizedRegistry = normalizeCustomerHybridIntentRegistry(registry)
  if (!normalizedRegistry.length) {
    return []
  }

  const normalizedInput = normalizeComparableText(input)
  const normalizedReasoningInput = normalizeComparableText(
    reasoningInput == null ? input : reasoningInput,
  )

  return normalizedRegistry
    .map((rule) =>
      evaluateHybridIntentRule(rule, {
        normalizedInput,
        normalizedReasoningInput,
      }),
    )
    .filter(Boolean)
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, Math.max(1, Number(limit) || 3))
    .map(({ rule }) => ({
      id: rule.id,
      intent: rule.intent,
      examples: rule.examples.slice(0, 2),
    }))
}

