const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const shortenToMaxChars = (value, maxChars) => {
  const text = compact(value)
  if (!text || text.length <= maxChars) {
    return text
  }

  const sentences = text.match(/[^.!?]+[.!?]?/gu) || [text]
  let selected = ''
  for (const sentence of sentences) {
    const candidate = compact(`${selected} ${sentence}`)
    if (candidate.length > maxChars) {
      break
    }
    selected = candidate
  }

  if (selected) {
    return selected
  }

  return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}…`
}

export const validateResponseGuardrails = ({
  text,
  fallbackText = '',
  mode = null,
  maxChars = 280,
  requireQuestion = false,
  fallbackQuestion = '¿Querés contarme un poco más para orientarte mejor?',
}) => {
  const issues = []
  let nextText = compact(text)

  if (!nextText) {
    nextText = compact(fallbackText)
    issues.push('empty_response')
  }

  nextText = shortenToMaxChars(nextText, maxChars)

  const shouldRequireQuestion =
    requireQuestion || mode === 'exploration' || mode === 'unclear'
  if (shouldRequireQuestion && nextText && !/[?¿]/u.test(nextText)) {
    nextText = compact(`${nextText} ${fallbackQuestion}`)
    issues.push('missing_question')
    nextText = shortenToMaxChars(nextText, maxChars)
  }

  if (!nextText) {
    nextText = compact(fallbackQuestion)
    issues.push('fallback_question_applied')
  }

  return {
    text: nextText,
    issues,
  }
}
