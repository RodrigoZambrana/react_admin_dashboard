import {
  ConversationChannel,
  ConversationExternalIdentityKind,
} from '@prisma/client'

type IdentityCandidate = {
  kind: ConversationExternalIdentityKind
  value: string
  normalizedValue: string
  metadata?: Record<string, unknown> | null
}

const compactText = (value: unknown): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePhoneDigits = (value: unknown): string | null => {
  const digits = String(value || '').replace(/\D+/g, '')
  return digits.length >= 7 ? digits : null
}

const normalizeGenericIdentity = (value: unknown): string | null => {
  const normalized = compactText(value).toLowerCase()
  return normalized || null
}

const pushCandidate = (
  candidates: Map<string, IdentityCandidate>,
  candidate: IdentityCandidate | null,
) => {
  if (!candidate?.normalizedValue) {
    return
  }
  const fingerprint = `${candidate.kind}:${candidate.normalizedValue}`
  if (!candidates.has(fingerprint)) {
    candidates.set(fingerprint, candidate)
  }
}

const buildGenericIdentityCandidates = ({
  channel,
  userId,
  threadId,
}: {
  channel: ConversationChannel
  userId?: string | null
  threadId?: string | null
}): IdentityCandidate[] => {
  const candidates = new Map<string, IdentityCandidate>()
  const normalizedUser = normalizeGenericIdentity(userId)
  const normalizedThread = normalizeGenericIdentity(threadId)

  if (normalizedUser) {
    pushCandidate(candidates, {
      kind: ConversationExternalIdentityKind.USER,
      value: compactText(userId),
      normalizedValue: normalizedUser,
    })
    pushCandidate(candidates, {
      kind: ConversationExternalIdentityKind.CANONICAL,
      value: compactText(userId),
      normalizedValue: normalizedUser,
    })
  }

  if (normalizedThread) {
    pushCandidate(candidates, {
      kind: ConversationExternalIdentityKind.THREAD,
      value: compactText(threadId),
      normalizedValue: normalizedThread,
    })
  }

  return Array.from(candidates.values())
}

const buildWhatsappIdentityCandidates = ({
  userId,
  threadId,
}: {
  userId?: string | null
  threadId?: string | null
}): IdentityCandidate[] => {
  const candidates = new Map<string, IdentityCandidate>()
  const values = [compactText(userId), compactText(threadId)].filter(Boolean)
  const canonicalDigits =
    normalizePhoneDigits(userId) || normalizePhoneDigits(threadId) || null

  const addRawValue = (
    kind: ConversationExternalIdentityKind,
    value: string | null,
  ) => {
    const normalized = normalizeGenericIdentity(value)
    if (!normalized || !value) {
      return
    }
    pushCandidate(candidates, {
      kind,
      value,
      normalizedValue: normalized,
    })
  }

  addRawValue(ConversationExternalIdentityKind.USER, compactText(userId))
  addRawValue(ConversationExternalIdentityKind.THREAD, compactText(threadId))

  if (canonicalDigits) {
    pushCandidate(candidates, {
      kind: ConversationExternalIdentityKind.CANONICAL,
      value: canonicalDigits,
      normalizedValue: canonicalDigits,
    })
    pushCandidate(candidates, {
      kind: ConversationExternalIdentityKind.ALIAS,
      value: `${canonicalDigits}@s.whatsapp.net`,
      normalizedValue: `${canonicalDigits}@s.whatsapp.net`,
    })
    pushCandidate(candidates, {
      kind: ConversationExternalIdentityKind.ALIAS,
      value: `${canonicalDigits}@lid`,
      normalizedValue: `${canonicalDigits}@lid`,
    })
  }

  values.forEach((value) => {
    const digits = normalizePhoneDigits(value)
    if (digits) {
      pushCandidate(candidates, {
        kind: ConversationExternalIdentityKind.ALIAS,
        value,
        normalizedValue: digits,
      })
    }
  })

  return Array.from(candidates.values())
}

export const buildConversationIdentityCandidates = ({
  channel,
  userId,
  threadId,
}: {
  channel: ConversationChannel
  userId?: string | null
  threadId?: string | null
}): IdentityCandidate[] => {
  if (channel === ConversationChannel.WHATSAPP) {
    return buildWhatsappIdentityCandidates({ userId, threadId })
  }

  return buildGenericIdentityCandidates({ channel, userId, threadId })
}

export const resolveConversationCanonicalExternalUserId = ({
  channel,
  userId,
  threadId,
}: {
  channel: ConversationChannel
  userId?: string | null
  threadId?: string | null
}): string | null => {
  if (channel === ConversationChannel.WHATSAPP) {
    return normalizePhoneDigits(userId) || normalizePhoneDigits(threadId) || compactText(userId) || null
  }
  return compactText(userId) || null
}

export const shouldReuseClosedConversationByIdentity = (
  channel: ConversationChannel,
): boolean =>
  channel === ConversationChannel.WHATSAPP ||
  channel === ConversationChannel.FACEBOOK ||
  channel === ConversationChannel.INSTAGRAM
