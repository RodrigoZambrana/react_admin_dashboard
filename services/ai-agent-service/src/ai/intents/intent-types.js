export const INTENT_SOURCES = ['rule', 'llm', 'hybrid']

export const normalizeIntentSource = (value) =>
  INTENT_SOURCES.includes(String(value || '')) ? value : 'rule'

export const buildIntentDetection = ({
  intent,
  confidence = 0,
  source = 'rule',
  actionIntent = null,
  directActionIntent = null,
  matchedKeywords = [],
  decisionPath = [],
  referencedMessages = [],
}) => ({
  intent: String(intent || 'unknown'),
  confidence:
    typeof confidence === 'number' && Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : 0,
  source: normalizeIntentSource(source),
  actionIntent: actionIntent || null,
  directActionIntent: directActionIntent || null,
  matchedKeywords: Array.isArray(matchedKeywords)
    ? matchedKeywords.filter(Boolean)
    : [],
  decisionPath: Array.isArray(decisionPath) ? decisionPath.filter(Boolean) : [],
  referencedMessages: Array.isArray(referencedMessages)
    ? referencedMessages.filter(Boolean)
    : [],
})
