import crypto from 'node:crypto'

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value)

const asString = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const resolvePlatform = (payload, entry) => {
  const objectName = asString(payload?.object)?.toLowerCase()
  if (objectName === 'instagram') {
    return 'instagram'
  }

  const entryId = asString(entry?.id)
  if (entryId && entryId === asString(entry?.messaging?.[0]?.recipient?.id)) {
    return 'facebook'
  }

  return 'facebook'
}

const mapAttachment = (attachment) => {
  if (!isObject(attachment)) {
    return null
  }

  const payload = isObject(attachment.payload) ? attachment.payload : {}
  const assetType = asString(attachment.type) || 'file'
  const content = asString(payload.url)
  const textContent = asString(payload.title) || asString(payload.text)

  return {
    assetType,
    fileName: null,
    contentType: null,
    content,
    textContent,
    metadata: {
      type: assetType,
      url: content,
      title: asString(payload.title),
      stickerId: asString(payload.sticker_id),
      coordinates:
        Number.isFinite(payload.coordinates?.lat) && Number.isFinite(payload.coordinates?.long)
          ? {
              lat: payload.coordinates.lat,
              long: payload.coordinates.long,
            }
          : null,
      rawPayload: payload,
    },
  }
}

const extractText = (event) => {
  if (asString(event?.message?.text)) {
    return event.message.text.trim()
  }

  if (asString(event?.postback?.title)) {
    return event.postback.title.trim()
  }

  if (asString(event?.postback?.payload)) {
    return event.postback.payload.trim()
  }

  return ''
}

const buildMetadata = ({ payload, entry, event, platform }) => {
  const message = isObject(event?.message) ? event.message : {}
  const postback = isObject(event?.postback) ? event.postback : {}
  const quickReply = isObject(message.quick_reply) ? message.quick_reply : {}

  const providerMessageId =
    asString(message.mid) ||
    asString(postback.mid) ||
    asString(event?.mid) ||
    null

  const attachments = Array.isArray(message.attachments)
    ? message.attachments.map(mapAttachment).filter(Boolean)
    : []

  const eventType = attachments.length > 0 && !asString(message.text)
    ? 'attachment'
    : postback.payload
      ? 'postback'
      : 'message'

  return {
    transport: 'meta',
    provider: 'meta-graph',
    platform,
    object: asString(payload?.object) || null,
    pageId: asString(entry?.id) || asString(event?.recipient?.id) || null,
    recipientId: asString(event?.recipient?.id) || null,
    threadId: asString(event?.sender?.id) || null,
    providerMessageId,
    quickReplyPayload: asString(quickReply.payload),
    postbackPayload: asString(postback.payload),
    postbackTitle: asString(postback.title),
    eventType,
    timestamp:
      Number.isFinite(Number(event?.timestamp)) && Number(event.timestamp) > 0
        ? new Date(Number(event.timestamp)).toISOString()
        : new Date().toISOString(),
    rawEventCategory:
      typeof event?.message === 'object'
        ? 'message'
        : typeof event?.postback === 'object'
          ? 'postback'
          : typeof event?.delivery === 'object'
            ? 'delivery'
            : typeof event?.read === 'object'
              ? 'read'
              : typeof event?.reaction === 'object'
                ? 'reaction'
                : 'unknown',
    attachments:
      attachments.length > 0
        ? attachments.map((attachment) => attachment.metadata)
        : null,
  }
}

export const validateMetaWebhookVerification = (searchParams, verifyToken) => {
  const mode = asString(searchParams?.get?.('hub.mode'))
  const token = asString(searchParams?.get?.('hub.verify_token'))
  const challenge = asString(searchParams?.get?.('hub.challenge'))

  if (mode !== 'subscribe' || !challenge) {
    return {
      ok: false,
      statusCode: 400,
      body: 'invalid webhook verification request',
    }
  }

  if (!verifyToken || token !== verifyToken) {
    return {
      ok: false,
      statusCode: 403,
      body: 'forbidden',
    }
  }

  return {
    ok: true,
    statusCode: 200,
    body: challenge,
  }
}

export const validateMetaWebhookSignature = (rawBody, signatureHeader, appSecret) => {
  if (!appSecret) {
    return false
  }

  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '')
  const signatureValue = asString(signatureHeader)
  if (!signatureValue) {
    return false
  }

  const [algorithm, digest] = signatureValue.split('=')
  if (!algorithm || !digest) {
    return false
  }

  const normalizedAlgorithm = algorithm.trim().toLowerCase()
  const hashAlgorithm =
    normalizedAlgorithm === 'sha1' ? 'sha1' : normalizedAlgorithm === 'sha256' ? 'sha256' : null

  if (!hashAlgorithm) {
    return false
  }

  const expected = crypto.createHmac(hashAlgorithm, appSecret).update(raw).digest('hex')
  const providedBuffer = Buffer.from(digest.trim(), 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

export const extractMetaWebhookEvents = (payload, options = {}) => {
  const tenantKey = asString(options?.tenantKey) || 'default'
  const entries = Array.isArray(payload?.entry) ? payload.entry : []
  const events = []

  for (const entry of entries) {
    const platform = resolvePlatform(payload, entry)
    const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : []

    for (const event of messagingEvents) {
      if (!isObject(event) || event?.message?.is_echo === true) {
        continue
      }

      if (!event?.sender?.id) {
        continue
      }

      const attachments = Array.isArray(event?.message?.attachments)
        ? event.message.attachments.map(mapAttachment).filter(Boolean)
        : []
      const text = extractText(event)
      const metadata = buildMetadata({ payload, entry, event, platform })

      const eventType = metadata.eventType
      const isStatusEvent = ['delivery', 'read', 'reaction'].includes(metadata.rawEventCategory)
      if (isStatusEvent) {
        events.push({
          type: 'status',
          platform,
          payload: {
            tenantKey,
            channel: platform,
            userId: String(event.sender.id),
            inboxAddress: metadata.pageId,
            threadId: metadata.threadId,
            messageId: metadata.providerMessageId,
            status: metadata.rawEventCategory,
            timestamp: event.timestamp,
            metadata,
          },
        })
        continue
      }

      if (!text && attachments.length === 0) {
        continue
      }

      events.push({
        type: 'message',
        platform,
        payload: {
          tenantKey,
          channel: platform,
          from: String(event.sender.id),
          userId: String(event.sender.id),
          inboxAddress: metadata.pageId,
          threadId: metadata.threadId,
          messageId: metadata.providerMessageId,
          providerMessageId: metadata.providerMessageId,
          text,
          attachments,
          authorKind: 'customer_human',
          messageKind:
            eventType === 'attachment' && !text ? 'attachment_only' : 'human_message',
          metadata,
          receivedAt:
            Number.isFinite(Number(event?.timestamp)) && Number(event.timestamp) > 0
              ? new Date(Number(event.timestamp)).toISOString()
              : undefined,
        },
      })
    }
  }

  return events
}
