import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import { MetaAdapter } from './meta.adapter.js'
import {
  extractMetaWebhookEvents,
  validateMetaWebhookSignature,
  validateMetaWebhookVerification,
} from './meta.webhook.js'

const createAdapter = ({ respond, options = {} } = {}) => {
  const aiCalls = []
  const replies = []

  const adapter = new MetaAdapter(
    {
      conversations: {
        ingestInboundMessage: async (payload) => ({
          conversationId: 'conv_meta_1',
          controlMode: 'ai',
          payload,
        }),
        replyAsAgent: async (conversationId, payload) => {
          replies.push({ conversationId, payload })
          return { conversationId, payload }
        },
      },
      ai: {
        respond: async (payload) => {
          aiCalls.push(payload)
          if (typeof respond === 'function') {
            return respond(payload, { aiCalls, replies })
          }

          return {
            response: {
              finalUserText: 'Respuesta automática',
              provider: 'mock',
              model: 'mock-model',
              toolCalls: [],
              needsHuman: false,
              grounding: null,
            },
          }
        },
      },
    },
    {
      clientSlug: 'urucortinas',
      metaVerifyToken: 'verify-token',
      metaAppSecret: 'app-secret',
      messengerPageAccessToken: 'page-token',
    },
    {
      sender: {
        sendMessage: async (payload) => ({
          provider: 'meta-graph',
          remoteId: 'mid.out.1',
          providerMessageId: 'mid.out.1',
          threadRemoteId: payload.threadId || payload.recipientId,
          deliveryStatus: 'accepted',
          metadata: {
            platform: payload.platform,
          },
        }),
      },
      quietWindowMs: 10,
      maxWindowMs: 20,
      ...options,
    },
  )

  return { adapter, aiCalls, replies }
}

test('validateMetaWebhookVerification returns challenge when token matches', () => {
  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'verify-token',
    'hub.challenge': 'abc123',
  })

  const result = validateMetaWebhookVerification(params, 'verify-token')
  assert.equal(result.ok, true)
  assert.equal(result.body, 'abc123')
})

test('validateMetaWebhookSignature validates sha256 signature', () => {
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }))
  const digest = crypto.createHmac('sha256', 'app-secret').update(rawBody).digest('hex')
  const isValid = validateMetaWebhookSignature(rawBody, `sha256=${digest}`, 'app-secret')
  assert.equal(isValid, true)
})

test('extractMetaWebhookEvents maps Messenger text webhook into internal payload', () => {
  const events = extractMetaWebhookEvents({
    object: 'page',
    entry: [
      {
        id: 'page-1',
        messaging: [
          {
            sender: { id: 'user-1' },
            recipient: { id: 'page-1' },
            timestamp: 1774780000000,
            message: {
              mid: 'm_1',
              text: 'Hola Meta',
            },
          },
        ],
      },
    ],
  }, { tenantKey: 'urucortinas' })

  assert.equal(events.length, 1)
  assert.equal(events[0].type, 'message')
  assert.equal(events[0].payload.channel, 'facebook')
  assert.equal(events[0].payload.userId, 'user-1')
  assert.equal(events[0].payload.text, 'Hola Meta')
  assert.equal(events[0].payload.metadata.providerMessageId, 'm_1')
})

test('extractMetaWebhookEvents maps Instagram attachments and postbacks', () => {
  const events = extractMetaWebhookEvents({
    object: 'instagram',
    entry: [
      {
        id: 'ig-account-1',
        messaging: [
          {
            sender: { id: 'ig-user-1' },
            recipient: { id: 'ig-account-1' },
            timestamp: 1774780000000,
            postback: {
              mid: 'pb_1',
              title: 'Ver opciones',
              payload: 'show_options',
            },
          },
          {
            sender: { id: 'ig-user-1' },
            recipient: { id: 'ig-account-1' },
            timestamp: 1774780000001,
            message: {
              mid: 'att_1',
              attachments: [
                {
                  type: 'image',
                  payload: {
                    url: 'https://cdn.example.com/image.jpg',
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  }, { tenantKey: 'urucortinas' })

  assert.equal(events.length, 2)
  assert.equal(events[0].payload.channel, 'instagram')
  assert.equal(events[0].payload.text, 'Ver opciones')
  assert.equal(events[0].payload.metadata.postbackPayload, 'show_options')
  assert.equal(events[1].payload.attachments.length, 1)
  assert.equal(events[1].payload.attachments[0].assetType, 'image')
})

test('MetaAdapter handleWebhook processes message events and skips status events', async () => {
  const { adapter } = createAdapter()

  const result = await adapter.handleWebhook({
    object: 'page',
    entry: [
      {
        id: 'page-1',
        messaging: [
          {
            sender: { id: 'user-1' },
            recipient: { id: 'page-1' },
            timestamp: 1774780000000,
            message: {
              mid: 'm_1',
              text: 'Hola',
            },
          },
          {
            sender: { id: 'user-1' },
            recipient: { id: 'page-1' },
            timestamp: 1774780000001,
            read: {
              watermark: 1774780000001,
            },
          },
        ],
      },
    ],
  })

  assert.equal(result.processedEvents, 1)
  assert.equal(result.ignoredEvents, 0)
  assert.equal(result.statusResult.statuses, 0)
})

test('MetaAdapter sendOutbound delegates to sender', async () => {
  const { adapter } = createAdapter()
  const result = await adapter.sendOutbound({
    channel: 'facebook',
    recipientId: 'user-2',
    text: 'Hola desde outbound',
  })

  assert.equal(result.remoteId, 'mid.out.1')
  assert.equal(result.channel, 'facebook')
})

test('MetaAdapter status exposes readiness and webhook URL', () => {
  const adapter = new MetaAdapter(
    { conversations: {}, ai: {} },
    {
      metaEnabled: true,
      metaMessengerEnabled: true,
      metaInstagramEnabled: true,
      metaVerifyToken: 'verify-token',
      metaAppSecret: 'secret',
      metaAppId: 'app-1',
      metaPublicBaseUrl: 'https://public.example.com',
      metaPageId: 'page-1',
      messengerPageAccessToken: 'page-token',
      instagramAccessToken: 'ig-token',
      instagramBusinessAccountId: 'ig-business-1',
    },
    { sender: { sendMessage: async () => ({}) } },
  )

  const status = adapter.getStatus()
  assert.equal(status.webhookInboundReady, true)
  assert.equal(status.publicWebhookUrl, 'https://public.example.com/webhooks/meta')
  assert.equal(status.messenger.outboundReady, true)
  assert.equal(status.instagram.outboundReady, true)
})

test('MetaAdapter coalesces related consecutive fragments into one semantic turn and one AI call', async () => {
  const { adapter, aiCalls, replies } = createAdapter({
    respond: async (payload) => ({
      response: {
        finalUserText:
          String(payload.text || '').includes('2x2')
            ? 'Perfecto, serían dos roller blackout de 2x2. Tomo los datos para cotizarte.'
            : 'Necesito un dato más.',
        provider: 'mock',
        model: 'mock-model',
        toolCalls: [],
        needsHuman: false,
        grounding: null,
      },
    }),
    options: {
      quietWindowMs: 15,
      maxWindowMs: 80,
    },
  })

  void adapter.handleInboundEvent({
    tenantKey: 'urucortinas',
    channel: 'facebook',
    userId: 'user-1',
    conversationId: 'conv-meta-fragments',
    text: 'si, necesito dos',
    metadata: {},
  })

  await new Promise((resolve) => setTimeout(resolve, 5))

  await adapter.handleInboundEvent({
    tenantKey: 'urucortinas',
    channel: 'facebook',
    userId: 'user-1',
    conversationId: 'conv-meta-fragments',
    text: 'de 2x2',
    metadata: {},
  })

  await new Promise((resolve) => setTimeout(resolve, 250))

  assert.equal(aiCalls.length, 1)
  assert.match(aiCalls[0].text, /si, necesito dos[\s\S]*de 2x2/i)
  assert.equal(aiCalls[0].metadata?.semanticTurnInputCount, 2)
  assert.equal(replies.length, 1)
  assert.equal(replies[0].payload.metadata?.semanticTurnInputCount, 2)
  assert.match(replies[0].payload.body, /roller blackout de 2x2/i)
})

test('MetaAdapter ignores disabled platform inbound and blocks outbound', async () => {
  const adapter = new MetaAdapter(
    {
      conversations: {
        ingestInboundMessage: async () => {
          throw new Error('should not ingest')
        },
      },
      ai: {},
    },
    {
      metaEnabled: true,
      metaMessengerEnabled: true,
      metaInstagramEnabled: false,
      messengerPageAccessToken: 'page-token',
    },
    { sender: { sendMessage: async () => ({}) } },
  )

  const inbound = await adapter.handleInboundEvent({
    tenantKey: 'urucortinas',
    channel: 'instagram',
    userId: 'ig-user-1',
    text: 'hola',
    metadata: {},
  })

  assert.equal(inbound.skipped, true)

  await assert.rejects(
    () =>
      adapter.sendOutbound({
        channel: 'instagram',
        recipientId: 'ig-user-1',
        text: 'hola',
      }),
    /disabled/,
  )
})
