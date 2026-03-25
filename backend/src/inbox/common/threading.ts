type AddressLike = { address?: string | null } | string | null | undefined

const SUBJECT_PREFIXES = [
  're',
  'fw',
  'fwd',
  'rv',
  'res',
  'enc',
  'tr',
  'sv',
  'aw',
  'wg',
  'antw',
  'rép',
  'rsp',
  'resposta',
  '答复',
  '回复',
  '答覆',
]

const escapeRegex = (value: string) =>
  value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

export const normalizeThreadString = (value?: string | null) =>
  (value ?? '').trim().toLowerCase()

export const normalizeThreadSubject = (subject?: string | null) => {
  const raw = (subject ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (!raw) {
    return ''
  }
  let normalized = raw
  let changed = true
  while (changed) {
    changed = false
    for (const prefix of SUBJECT_PREFIXES) {
      const rx = new RegExp(`^${escapeRegex(prefix)}:\\s*`, 'i')
      if (rx.test(normalized)) {
        normalized = normalized.replace(rx, '').trim()
        changed = true
      }
    }
  }
  return normalized
}

const normalizeAddress = (value: AddressLike) => {
  if (!value) {
    return ''
  }
  if (typeof value === 'string') {
    return normalizeThreadString(value)
  }
  return normalizeThreadString(value.address)
}

const normalizeAddressList = (addresses?: AddressLike[]) =>
  (addresses ?? [])
    .map((entry) => normalizeAddress(entry))
    .filter((entry) => entry.length > 0)
    .sort()
    .join(',')

const extractReferenceIds = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeThreadString(String(entry).replace(/[<>]/g, '')))
      .filter((entry) => entry.length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(/\s+/)
      .map((entry) => normalizeThreadString(entry.replace(/[<>]/g, '')))
      .filter((entry) => entry.length > 0)
  }
  return []
}

export const buildCanonicalThreadKey = (input: {
  threadRemoteId?: string | null
  gmailThreadId?: string | null
  messageId?: string | null
  inReplyTo?: string | null
  references?: string[] | string | null
  subject?: string | null
  fromAddress?: string | null
  toAddresses?: AddressLike[]
}) => {
  const providerThreadId =
    normalizeThreadString(input.threadRemoteId) ||
    normalizeThreadString(input.gmailThreadId)
  if (providerThreadId) {
    return {
      key: `thread:${providerThreadId}`,
      reason: 'provider-thread',
    }
  }

  const references = extractReferenceIds(input.references)
  const inReplyTo = normalizeThreadString(
    input.inReplyTo?.replace(/[<>]/g, '') ?? null,
  )
  const messageId = normalizeThreadString(
    input.messageId?.replace(/[<>]/g, '') ?? null,
  )

  const rootReference = references[0] || inReplyTo || messageId
  if (rootReference) {
    return {
      key: `message-chain:${rootReference}`,
      reason: references.length > 0 ? 'references' : inReplyTo ? 'in-reply-to' : 'message-id',
    }
  }

  const normalizedSubject = normalizeThreadSubject(input.subject)
  const normalizedParticipants = [
    normalizeAddress(input.fromAddress ?? null),
    normalizeAddressList(input.toAddresses),
  ]
    .filter((entry) => entry.length > 0)
    .join('|')

  if (normalizedSubject && normalizedParticipants) {
    return {
      key: `subject-participants:${normalizedSubject}:${normalizedParticipants}`,
      reason: 'subject-participants',
    }
  }

  if (normalizedSubject) {
    return {
      key: `subject:${normalizedSubject}`,
      reason: 'normalized-subject',
    }
  }

  const participants = normalizedParticipants
  if (participants) {
    return {
      key: `participant:${participants}`,
      reason: 'participant-fallback',
    }
  }

  return {
    key: 'unthreaded',
    reason: 'fallback',
  }
}

export const resolveMessageActivityAt = (input: {
  receivedAt?: Date | null
  sentAt?: Date | null
}) => {
  const receivedAt =
    input.receivedAt instanceof Date && !Number.isNaN(input.receivedAt.getTime())
      ? input.receivedAt
      : null
  const sentAt =
    input.sentAt instanceof Date && !Number.isNaN(input.sentAt.getTime())
      ? input.sentAt
      : null

  if (receivedAt && sentAt) {
    return receivedAt.getTime() >= sentAt.getTime() ? receivedAt : sentAt
  }
  return receivedAt ?? sentAt ?? null
}
