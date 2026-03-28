import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeEmailPayload,
  normalizeMetaPayload,
  normalizeWebchatPayload,
} from './unified-message.js'

test('normalizeWebchatPayload sets canonical authorKind and messageKind defaults', () => {
  const normalized = normalizeWebchatPayload({
    tenantKey: 'urucortinas',
    conversationId: 'conv-webchat-1',
    guestId: 'guest-1',
    text: 'Hola',
  })

  assert.equal(normalized.authorKind, 'customer_human')
  assert.equal(normalized.messageKind, 'human_message')
  assert.equal(normalized.metadata.authorKind, 'customer_human')
  assert.equal(normalized.metadata.messageKind, 'human_message')
})

test('normalizeMetaPayload preserves explicit business auto reply classification', () => {
  const normalized = normalizeMetaPayload({
    tenantKey: 'urucortinas',
    channel: 'whatsapp',
    from: '+59899111222',
    text: 'Gracias por tu mensaje.',
    authorKind: 'business_auto',
    messageKind: 'business_auto_reply',
  })

  assert.equal(normalized.authorKind, 'business_auto')
  assert.equal(normalized.messageKind, 'business_auto_reply')
  assert.equal(normalized.metadata.authorKind, 'business_auto')
  assert.equal(normalized.metadata.messageKind, 'business_auto_reply')
})

test('normalizeEmailPayload detects attachment-only canonical messages', () => {
  const normalized = normalizeEmailPayload({
    tenantKey: 'urucortinas',
    fromAddress: 'cliente@example.com',
    attachments: [
      {
        fileName: 'plano.pdf',
        contentType: 'application/pdf',
      },
    ],
  })

  assert.equal(normalized.authorKind, 'customer_human')
  assert.equal(normalized.messageKind, 'attachment_only')
  assert.equal(normalized.metadata.messageKind, 'attachment_only')
})
