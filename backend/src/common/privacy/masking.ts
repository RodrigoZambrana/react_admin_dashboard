export const maskEmailAddress = (value?: string | null): string => {
  const email = (value ?? '').trim()
  if (!email) return ''

  const atIndex = email.indexOf('@')
  if (atIndex <= 0) {
    return email
  }

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)
  if (!domain) {
    return email
  }

  const visibleLocalStart = local.slice(0, Math.min(2, local.length))
  const visibleLocalEnd = local.length > 4 ? local.slice(-1) : ''
  const localMaskLength = Math.max(2, local.length - visibleLocalStart.length - visibleLocalEnd.length)
  const maskedLocal = `${visibleLocalStart}${'*'.repeat(localMaskLength)}${visibleLocalEnd}`

  return `${maskedLocal}@${domain}`
}

export const maskEmailList = (values?: string[] | null): string[] => {
  if (!Array.isArray(values)) {
    return []
  }

  return values.map((value) => maskEmailAddress(value))
}

