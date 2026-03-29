import test from 'node:test'
import assert from 'node:assert/strict'

import { MetaSender } from './meta.sender.js'

test('MetaSender sends plain text to Messenger endpoint', async () => {
  let captured = null
  const sender = new MetaSender(
    {
      messengerPageAccessToken: 'page-token',
      metaGraphVersion: 'v23.0',
    },
    {
      fetchImpl: async (url, init) => {
        captured = { url, init }
        return {
          ok: true,
          text: async () => JSON.stringify({ message_id: 'mid.1' }),
        }
      },
    },
  )

  const result = await sender.sendMessage({
    platform: 'facebook',
    recipientId: 'user-1',
    text: 'Hola desde Messenger',
  })

  assert.equal(captured.url, 'https://graph.facebook.com/v23.0/me/messages')
  const parsedBody = JSON.parse(captured.init.body)
  assert.equal(parsedBody.recipient.id, 'user-1')
  assert.equal(parsedBody.message.text, 'Hola desde Messenger')
  assert.equal(result.remoteId, 'mid.1')
})

test('MetaSender includes quick replies when provided', async () => {
  let captured = null
  const sender = new MetaSender(
    {
      messengerPageAccessToken: 'page-token',
    },
    {
      fetchImpl: async (url, init) => {
        captured = { url, init }
        return {
          ok: true,
          text: async () => JSON.stringify({ message_id: 'mid.2' }),
        }
      },
    },
  )

  await sender.sendMessage({
    platform: 'facebook',
    recipientId: 'user-2',
    text: 'Elegí una opción',
    quickReplies: [
      { title: 'Sí', payload: 'yes' },
      { title: 'No', payload: 'no' },
    ],
  })

  const parsedBody = JSON.parse(captured.init.body)
  assert.equal(parsedBody.message.quick_replies.length, 2)
  assert.equal(parsedBody.message.quick_replies[0].title, 'Sí')
  assert.equal(parsedBody.message.quick_replies[0].payload, 'yes')
})

test('MetaSender uses Instagram account endpoint when configured', async () => {
  let capturedUrl = null
  const sender = new MetaSender(
    {
      instagramAccessToken: 'ig-token',
      instagramBusinessAccountId: '17841400000000000',
    },
    {
      fetchImpl: async (url) => {
        capturedUrl = url
        return {
          ok: true,
          text: async () => JSON.stringify({ message_id: 'ig.mid.1' }),
        }
      },
    },
  )

  await sender.sendMessage({
    platform: 'instagram',
    recipientId: 'ig-user-1',
    text: 'Hola Instagram',
  })

  assert.equal(
    capturedUrl,
    'https://graph.facebook.com/v23.0/17841400000000000/messages',
  )
})

test('MetaSender retries on rate limit', async () => {
  let attempts = 0
  const sender = new MetaSender(
    {
      messengerPageAccessToken: 'page-token',
      metaSenderMaxRetries: 1,
    },
    {
      fetchImpl: async () => {
        attempts += 1
        if (attempts === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ error: { message: 'rate limited' } }),
          }
        }
        return {
          ok: true,
          text: async () => JSON.stringify({ message_id: 'mid.retry' }),
        }
      },
    },
  )

  const result = await sender.sendMessage({
    platform: 'facebook',
    recipientId: 'user-rate-limit',
    text: 'Hola',
  })

  assert.equal(attempts, 2)
  assert.equal(result.remoteId, 'mid.retry')
})
