import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { WhatsappQrAdapter } from './whatsapp-qr.adapter.js'

const createAdapter = () => {
  const adapter = new WhatsappQrAdapter(
    {
      conversations: {
        bootstrapChannelThread: async () => ({
          conversationId: 'conv_bootstrap',
          createdConversation: false,
        }),
        importChannelHistoryMessage: async () => ({
          conversationId: 'conv_history',
          duplicate: false,
        }),
      },
      ai: {},
    },
    {
      clientSlug: 'urucortinas',
      whatsappRuntimeDir: '/tmp/whatsapp-qr-test-runtime',
    },
  )

  adapter.runtimeConfig = {
    ...adapter.runtimeConfig,
    enabled: true,
    typingIndicatorEnabled: false,
    presenceIndicatorEnabled: false,
    humanDelayEnabled: false,
    minReplyDelayMs: 0,
    maxReplyDelayMs: 0,
  }

  return adapter
}

test('sendOutbound prefers the explicit threadId for lid conversations', async () => {
  const adapter = createAdapter()
  let capturedJid = null

  adapter.sock = {
    sendPresenceUpdate: async () => undefined,
    sendMessage: async (jid, payload) => {
      capturedJid = jid
      assert.deepEqual(payload, { text: 'Hola desde CRM' })
      return {
        key: {
          id: 'waqr-msg-1',
        },
      }
    },
  }

  const result = await adapter.sendOutbound({
    text: 'Hola desde CRM',
    recipientId: '59890000001',
    threadId: '92573926477882@lid',
  })

  assert.equal(capturedJid, '92573926477882@lid')
  assert.equal(result.threadRemoteId, '92573926477882@lid')
  assert.equal(result.metadata.jid, '92573926477882@lid')
  assert.equal(result.metadata.threadId, '92573926477882@lid')
})

test('sendOutbound skips humanized delay and presence for operator replies', async () => {
  const adapter = createAdapter()
  let presenceCalls = 0

  adapter.sock = {
    sendPresenceUpdate: async () => {
      presenceCalls += 1
    },
    sendMessage: async (jid, payload) => {
      assert.equal(jid, '92573926477882@lid')
      assert.deepEqual(payload, { text: 'Respuesta manual' })
      return {
        key: {
          id: 'waqr-msg-2',
        },
      }
    },
  }

  const result = await adapter.sendOutbound({
    text: 'Respuesta manual',
    threadId: '92573926477882@lid',
    metadata: {
      source: 'admin-reply',
    },
  })

  assert.equal(presenceCalls, 0)
  assert.equal(result.metadata.typingDelayMs, 0)
})

test('reactToMessage sends a WhatsApp reaction using the stored lid thread', async () => {
  const adapter = createAdapter()
  let capturedPayload = null

  adapter.sock = {
    sendMessage: async (jid, payload) => {
      capturedPayload = { jid, payload }
      return { ok: true }
    },
  }

  const result = await adapter.reactToMessage({
    threadId: '92573926477882@lid',
    messageId: 'wamid.1234',
    emoji: '👍',
  })

  assert.equal(capturedPayload?.jid, '92573926477882@lid')
  assert.deepEqual(capturedPayload?.payload, {
    react: {
      text: '👍',
      key: {
        remoteJid: '92573926477882@lid',
        id: 'wamid.1234',
        fromMe: false,
        participant: null,
      },
    },
  })
  assert.equal(result.threadRemoteId, '92573926477882@lid')
  assert.equal(result.messageId, 'wamid.1234')
})

test('forwardMessage reuses the original message snapshot when available', async () => {
  const adapter = createAdapter()
  let capturedPayload = null

  adapter.sock = {
    sendMessage: async (jid, payload) => {
      capturedPayload = { jid, payload }
      return {
        key: {
          id: 'waqr-forward-1',
        },
      }
    },
  }

  const snapshot = {
    key: {
      remoteJid: '59890000001@lid',
      id: 'wamid.src-1',
      fromMe: false,
      participant: null,
    },
    message: {
      conversation: 'Hola desde el origen',
    },
    messageTimestamp: 1711632060,
  }

  const result = await adapter.forwardMessage({
    targetThreadId: '139380295507983@lid',
    messageSnapshot: snapshot,
  })

  assert.equal(capturedPayload?.jid, '139380295507983@lid')
  assert.deepEqual(capturedPayload?.payload, {
    forward: snapshot,
    force: false,
  })
  assert.equal(result.threadRemoteId, '139380295507983@lid')
  assert.equal(result.remoteId, 'waqr-forward-1')
})

test('replyToMessage sends a quoted reply using the stored snapshot', async () => {
  const adapter = createAdapter()
  let captured = null

  adapter.sock = {
    sendMessage: async (jid, payload, options) => {
      captured = { jid, payload, options }
      return {
        key: {
          id: 'waqr-reply-1',
        },
      }
    },
  }

  const snapshot = {
    key: {
      remoteJid: '59890000001@lid',
      id: 'wamid.src-quote',
      fromMe: false,
      participant: null,
    },
    message: {
      conversation: 'Mensaje original',
    },
    messageTimestamp: 1_711_632_060,
  }

  const result = await adapter.replyToMessage({
    threadId: '59890000001@lid',
    text: 'Respuesta citada',
    messageSnapshot: snapshot,
  })

  assert.equal(captured?.jid, '59890000001@lid')
  assert.deepEqual(captured?.payload, {
    text: 'Respuesta citada',
  })
  assert.deepEqual(captured?.options, {
    quoted: snapshot,
  })
  assert.equal(result.remoteId, 'waqr-reply-1')
})

test('editMessage updates an outbound message using edit payload', async () => {
  const adapter = createAdapter()
  let captured = null

  adapter.sock = {
    sendMessage: async (jid, payload) => {
      captured = { jid, payload }
      return {
        key: {
          id: 'waqr-edit-1',
        },
      }
    },
  }

  const result = await adapter.editMessage({
    threadId: '59890000001@lid',
    messageId: 'wamid.out-1',
    fromMe: true,
    text: 'Texto corregido',
  })

  assert.equal(captured?.jid, '59890000001@lid')
  assert.deepEqual(captured?.payload, {
    text: 'Texto corregido',
    edit: {
      remoteJid: '59890000001@lid',
      id: 'wamid.out-1',
      fromMe: true,
      participant: null,
    },
  })
  assert.equal(result.messageId, 'wamid.out-1')
})

test('setMessageStar uses chatModify with message ref', async () => {
  const adapter = createAdapter()
  let captured = null

  adapter.sock = {
    chatModify: async (payload, jid) => {
      captured = { payload, jid }
      return { ok: true }
    },
  }

  const result = await adapter.setMessageStar({
    threadId: '59890000001@lid',
    messageId: 'wamid.star-1',
    fromMe: false,
    starred: true,
  })

  assert.equal(captured?.jid, '59890000001@lid')
  assert.deepEqual(captured?.payload, {
    star: {
      messages: [
        {
          id: 'wamid.star-1',
          fromMe: false,
          participant: null,
        },
      ],
      star: true,
    },
  })
  assert.equal(result.starred, true)
})

test('archiveChat uses chatModify with last message context', async () => {
  const adapter = createAdapter()
  let captured = null

  adapter.sock = {
    chatModify: async (payload, jid) => {
      captured = { payload, jid }
      return { ok: true }
    },
  }

  const result = await adapter.archiveChat({
    threadId: '59890000001@lid',
    archived: true,
    messageId: 'wamid.last-1',
    fromMe: false,
    messageTimestamp: 1_711_632_060,
  })

  assert.equal(captured?.jid, '59890000001@lid')
  assert.deepEqual(captured?.payload, {
    archive: true,
    lastMessages: [
      {
        key: {
          remoteJid: '59890000001@lid',
          id: 'wamid.last-1',
          fromMe: false,
          participant: null,
        },
        messageTimestamp: 1711632060,
      },
    ],
  })
  assert.equal(result.archived, true)
})

test('history sync imports inbound and outbound messages without triggering AI', async () => {
  const importedPayloads = []
  const adapter = new WhatsappQrAdapter(
    {
      conversations: {
        bootstrapChannelThread: async () => ({
          conversationId: 'conv-bootstrap',
          createdConversation: false,
        }),
        importChannelHistoryMessage: async (payload) => {
          importedPayloads.push(payload)
          return {
            conversationId: `conv:${payload.externalMessageId}`,
            duplicate: false,
          }
        },
      },
      ai: {
        respond: async () => {
          throw new Error('history sync must not call ai')
        },
      },
    },
    {
      clientSlug: 'urucortinas',
      whatsappRuntimeDir: '/tmp/whatsapp-qr-test-runtime',
    },
  )

  adapter.runtimeConfig = {
    ...adapter.runtimeConfig,
    enabled: true,
  }

  await adapter.handleMessagingHistorySet({
    chats: [
      {
        id: '59890000001@lid',
        name: 'Cliente real',
      },
    ],
    messages: [
      {
        key: {
          id: 'history-in-1',
          remoteJid: '59890000001@lid',
          fromMe: false,
        },
        messageTimestamp: 1_711_632_000,
        pushName: 'Cliente real',
        message: {
          conversation: 'Hola, necesito info',
        },
      },
      {
        key: {
          id: 'history-out-1',
          remoteJid: '59890000001@lid',
          fromMe: true,
        },
        messageTimestamp: 1_711_632_060,
        message: {
          conversation: 'Claro, contame qué precisás',
        },
      },
    ],
  })

  assert.equal(importedPayloads.length, 2)
  assert.deepEqual(
    importedPayloads.map((entry) => ({
      direction: entry.direction,
      authorKind: entry.authorKind,
      externalMessageId: entry.externalMessageId,
      threadId: entry.threadId,
    })),
    [
      {
        direction: 'inbound',
        authorKind: 'customer_human',
        externalMessageId: 'history-in-1',
        threadId: '59890000001@lid',
      },
      {
        direction: 'outbound',
        authorKind: 'operator_human',
        externalMessageId: 'history-out-1',
        threadId: '59890000001@lid',
      },
    ],
  )
})

test('backfill bootstraps known auth-state contacts without creating a self chat', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'waqr-auth-bootstrap-'))
  const authDir = path.join(runtimeDir, 'auth')
  await fs.mkdir(authDir, { recursive: true })

  await fs.writeFile(
    path.join(authDir, 'lid-mapping-59898488759.json'),
    JSON.stringify('276377571979335'),
  )
  await fs.writeFile(
    path.join(authDir, 'lid-mapping-59891284204.json'),
    JSON.stringify('92573926477882'),
  )
  await fs.writeFile(
    path.join(authDir, 'lid-mapping-59891471217.json'),
    JSON.stringify('139380295507983'),
  )
  await fs.writeFile(path.join(authDir, 'session-276377571979335_1.0.json'), '{}')
  await fs.writeFile(path.join(authDir, 'session-92573926477882_1.0.json'), '{}')
  await fs.writeFile(path.join(authDir, 'device-list-139380295507983.json'), '[]')

  const bootstrappedPayloads = []
  const adapter = new WhatsappQrAdapter(
    {
      conversations: {
        bootstrapChannelThread: async (payload) => {
          bootstrappedPayloads.push(payload)
          return {
            conversationId: `conv:${payload.threadId}`,
            createdConversation: true,
          }
        },
        importChannelHistoryMessage: async () => ({
          conversationId: 'conv-history',
          duplicate: false,
        }),
      },
      ai: {},
    },
    {
      clientSlug: 'urucortinas',
      whatsappRuntimeDir: runtimeDir,
    },
  )

  adapter.runtimeConfig = {
    ...adapter.runtimeConfig,
    enabled: true,
    address: '59898488759',
  }
  adapter.status.connectedPhone = '59898488759'

  const result = await adapter.backfillHistory()

  assert.equal(result.importedMessages, 0)
  assert.equal(result.bootstrappedFromAuth, 2)
  assert.equal(result.authBootstrapCandidates, 2)
  assert.deepEqual(
    bootstrappedPayloads.map((entry) => ({
      threadId: entry.threadId,
      userId: entry.userId,
    })),
    [
      {
        threadId: '139380295507983@lid',
        userId: '59891471217',
      },
      {
        threadId: '92573926477882@lid',
        userId: '59891284204',
      },
    ],
  )

  await fs.rm(runtimeDir, { recursive: true, force: true })
})

test('persisted store restores messages and chat labels across adapter instances', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'waqr-store-'))
  const first = new WhatsappQrAdapter(
    {
      conversations: {
        bootstrapChannelThread: async () => ({
          conversationId: 'conv_bootstrap',
          createdConversation: false,
        }),
        importChannelHistoryMessage: async () => ({
          conversationId: 'conv_history',
          duplicate: false,
        }),
      },
      ai: {},
    },
    {
      clientSlug: 'urucortinas',
      whatsappRuntimeDir: runtimeDir,
    },
  )

  first.storeMessage({
    key: {
      remoteJid: '59890000001@lid',
      id: 'wamid.persisted-1',
      fromMe: false,
    },
    message: {
      conversation: 'Mensaje persistido',
    },
    messageTimestamp: 1_711_632_000,
  })
  first.storeChat({
    id: '59890000001@lid',
    name: 'Cliente persistido',
  })
  await first.persistStore()

  const second = new WhatsappQrAdapter(
    {
      conversations: {
        bootstrapChannelThread: async () => ({
          conversationId: 'conv_bootstrap',
          createdConversation: false,
        }),
        importChannelHistoryMessage: async () => ({
          conversationId: 'conv_history',
          duplicate: false,
        }),
      },
      ai: {},
    },
    {
      clientSlug: 'urucortinas',
      whatsappRuntimeDir: runtimeDir,
    },
  )

  await second.loadPersistedStore()

  const restored = second.resolveStoredMessageByKey({
    remoteJid: '59890000001@lid',
    id: 'wamid.persisted-1',
  })

  assert.equal(restored?.message?.conversation, 'Mensaje persistido')
  assert.equal(second.historyChatNames.get('59890000001@lid'), 'Cliente persistido')

  await fs.rm(runtimeDir, { recursive: true, force: true })
})

test('captureChats keeps group chats in store but avoids bootstrapping them as CRM threads', () => {
  const adapter = createAdapter()

  adapter.captureChats([
    {
      id: '120363400000000000@g.us',
      name: 'Grupo operativo',
    },
  ])

  assert.equal(adapter.knownChats.size, 0)
  assert.equal(adapter.persistedChats.get('120363400000000000@g.us')?.isGroup, true)
})

test('group metadata cache refreshes from Baileys groupMetadata on updates', async () => {
  const adapter = createAdapter()
  let capturedJid = null

  adapter.sock = {
    groupMetadata: async (jid) => {
      capturedJid = jid
      return {
        id: jid,
        subject: 'Clientes VIP',
      }
    },
  }

  await adapter.handleGroupsUpdate([
    {
      id: '120363400000000000@g.us',
    },
  ])

  assert.equal(capturedJid, '120363400000000000@g.us')
  assert.equal(
    adapter.getCachedGroupMetadata('120363400000000000@g.us')?.subject,
    'Clientes VIP',
  )
})

test('messages.update refreshes the stored message for retries and later actions', async () => {
  const adapter = createAdapter()

  adapter.storeMessage({
    key: {
      remoteJid: '59890000001@lid',
      id: 'wamid.edit-1',
      fromMe: false,
    },
    message: {
      conversation: 'Texto original',
    },
    messageTimestamp: 1_711_632_000,
  })

  await adapter.handleMessagesUpdate([
    {
      key: {
        remoteJid: '59890000001@lid',
        id: 'wamid.edit-1',
      },
      update: {
        status: 2,
        message: {
          conversation: 'Texto editado',
        },
      },
    },
  ])

  const restored = adapter.resolveStoredMessageByKey({
    remoteJid: '59890000001@lid',
    id: 'wamid.edit-1',
  })

  assert.equal(restored?.message?.conversation, 'Texto editado')
  assert.equal(restored?.status, 2)
})
