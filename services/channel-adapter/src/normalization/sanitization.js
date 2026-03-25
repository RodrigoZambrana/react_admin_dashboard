export function sanitizeText(input) {
  if (typeof input !== 'string') {
    return ''
  }

  return input.replace(/\s+/g, ' ').trim().slice(0, 4000)
}
