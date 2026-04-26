import http from 'node:http'

import { AiPlatformAgentClient } from './clients/ai-platform-agent.client.js'
import { AiPlatformConversationsClient } from './clients/ai-platform-conversations.client.js'
import { ChannelControlClient } from './clients/channel-control.client.js'
import { EmailAdapter } from './channels/email/email.adapter.js'
import { MetaAdapter } from './channels/meta/meta.adapter.js'
import { WhatsappQrAdapter } from './channels/whatsapp-qr/whatsapp-qr.adapter.js'
import { WebchatAdapter } from './channels/webchat/webchat.adapter.js'

const port = Number(process.env.PORT || 4200)

const config = {
  service: 'channel-adapter',
  nodeEnv: process.env.NODE_ENV || 'development',
  aiPlatformBaseUrl: process.env.AI_PLATFORM_BASE_URL || 'http://ai-platform-backend:4110',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  internalToken: process.env.AI_INTERNAL_TOKEN || 'local-ai-internal-token',
  metaVerifyToken: process.env.META_VERIFY_TOKEN || process.env.VERIFY_TOKEN || '',
  metaAppSecret: process.env.META_APP_SECRET || process.env.APP_SECRET || '',
  metaAppId: process.env.META_APP_ID || '',
  metaPageId: process.env.META_PAGE_ID || '',
  metaPageAccessToken:
    process.env.META_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN || '',
  metaEnabled: process.env.META_CHANNEL_ENABLED !== 'false',
  metaMessengerEnabled: process.env.META_MESSENGER_ENABLED !== 'false',
  metaInstagramEnabled: process.env.META_INSTAGRAM_ENABLED !== 'false',
  metaPublicBaseUrl: process.env.META_PUBLIC_BASE_URL || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  instagramAccessToken:
    process.env.INSTAGRAM_ACCESS_TOKEN ||
    process.env.META_INSTAGRAM_ACCESS_TOKEN ||
    process.env.PAGE_ACCESS_TOKEN ||
    '',
  instagramBusinessAccountId:
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
    process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID ||
    '',
  messengerPageAccessToken:
    process.env.MESSENGER_PAGE_ACCESS_TOKEN ||
    process.env.META_MESSENGER_PAGE_ACCESS_TOKEN ||
    process.env.PAGE_ACCESS_TOKEN ||
    '',
  metaGraphVersion: process.env.META_GRAPH_VERSION || 'v23.0',
  metaGraphBaseUrl: process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com',
  metaSenderMaxRetries: process.env.META_SENDER_MAX_RETRIES || '2',
  clientSlug: process.env.CLIENT_SLUG || '',
  whatsappRuntimeDir: process.env.WHATSAPP_QR_RUNTIME_DIR || '/app/runtime/whatsapp-qr',
}

const json = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-ai-internal-token',
  })
  res.end(JSON.stringify(body))
}

const binary = (res, statusCode, content, headers = {}) => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
  res.writeHead(statusCode, {
    'content-length': buffer.byteLength,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-ai-internal-token',
    ...headers,
  })
  res.end(buffer)
}

const text = (res, statusCode, body, headers = {}) => {
  const payload = typeof body === 'string' ? body : String(body || '')
  res.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-ai-internal-token,x-hub-signature-256,x-hub-signature',
    ...headers,
  })
  res.end(payload)
}

const readRawBody = async (req) => {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (!chunks.length) {
    return Buffer.alloc(0)
  }
  return Buffer.concat(chunks)
}

const readBody = async (req) => {
  const raw = await readRawBody(req)
  if (!raw.length) {
    return null
  }
  return JSON.parse(raw.toString('utf8'))
}

const clients = {
  conversations: new AiPlatformConversationsClient(config),
  ai: new AiPlatformAgentClient(config),
  channelControl: new ChannelControlClient(config),
}

const webchatAdapter = new WebchatAdapter(clients)
const emailAdapter = new EmailAdapter(clients)
const metaAdapter = new MetaAdapter(clients, config)
const whatsappQrAdapter = new WhatsappQrAdapter(clients, config)

await metaAdapter.syncConfigFromControlPlane().catch((error) => {
  console.warn('[channel-adapter] meta control-plane sync failed during bootstrap', error)
})
await whatsappQrAdapter.syncConfigFromControlPlane().catch((error) => {
  console.warn('[channel-adapter] whatsapp-qr control-plane sync failed during bootstrap', error)
})
await whatsappQrAdapter.init()

const requireInternalToken = (req, res) => {
  const token = req.headers['x-ai-internal-token']
  if (token !== config.internalToken) {
    json(res, 401, {
      ok: false,
      message: 'unauthorized',
    })
    return false
  }
  return true
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      json(res, 404, { ok: false })
      return
    }

    const requestUrl = new URL(req.url, 'http://localhost')
    const pathname = requestUrl.pathname

    if (req.method === 'OPTIONS') {
      json(res, 200, { ok: true })
      return
    }

    if (req.method === 'GET' && pathname === '/health') {
      json(res, 200, {
        status: 'ok',
        service: config.service,
        timestamp: new Date().toISOString(),
      })
      return
    }

    if (req.method === 'GET' && pathname === '/channels') {
      json(res, 200, {
        channels: ['webchat', 'email', 'whatsapp_qr', 'whatsapp_meta', 'instagram', 'messenger'],
      })
      return
    }

    if (req.method === 'GET' && pathname === '/channels/whatsapp-qr/status') {
      if (!requireInternalToken(req, res)) {
        return
      }
      await whatsappQrAdapter.syncConfigFromControlPlane().catch(() => undefined)
      json(res, 200, whatsappQrAdapter.getStatus())
      return
    }

    if (req.method === 'GET' && pathname === '/channels/meta/status') {
      if (!requireInternalToken(req, res)) {
        return
      }
      await metaAdapter.syncConfigFromControlPlane().catch(() => undefined)
      json(res, 200, metaAdapter.getStatus())
      return
    }

    if (req.method === 'GET' && pathname === '/channels/meta/config/effective') {
      if (!requireInternalToken(req, res)) {
        return
      }
      await metaAdapter.syncConfigFromControlPlane().catch(() => undefined)
      json(res, 200, metaAdapter.getEffectiveConfig())
      return
    }

    if (req.method === 'PUT' && pathname === '/channels/meta/config') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, metaAdapter.updateConfig(body || {}))
      return
    }

    if (req.method === 'PUT' && pathname === '/channels/whatsapp-qr/config') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      const result = await whatsappQrAdapter.updateConfig(body || {})
      json(res, 200, result)
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/session/start') {
      if (!requireInternalToken(req, res)) {
        return
      }
      json(res, 200, await whatsappQrAdapter.startSession())
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/session/stop') {
      if (!requireInternalToken(req, res)) {
        return
      }
      json(res, 200, await whatsappQrAdapter.stopSession({ preserveAuth: true }))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/session/reconnect') {
      if (!requireInternalToken(req, res)) {
        return
      }
      json(res, 200, await whatsappQrAdapter.reconnectSession())
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/session/reset') {
      if (!requireInternalToken(req, res)) {
        return
      }
      json(res, 200, await whatsappQrAdapter.resetSession())
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/backfill') {
      if (!requireInternalToken(req, res)) {
        return
      }
      json(res, 200, await whatsappQrAdapter.backfillHistory())
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/message/reaction') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.reactToMessage(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/message/reply') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.replyToMessage(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/message/edit') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.editMessage(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/message/delete') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.deleteMessage(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/message/star') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.setMessageStar(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/message/forward') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.forwardMessage(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/message/media') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      const result = await whatsappQrAdapter.downloadMessageMedia(body || {})
      binary(res, 200, result.buffer, {
        'content-type': result.contentType || 'application/octet-stream',
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(
          result.fileName || 'whatsapp-media',
        )}`,
      })
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/chat/archive') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.archiveChat(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/chat/read-state') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.setChatRead(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/chat/pin-state') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.setChatPin(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/chat/mute-state') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.setChatMute(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/channels/whatsapp-qr/chat/delete') {
      if (!requireInternalToken(req, res)) {
        return
      }
      const body = await readBody(req)
      json(res, 200, await whatsappQrAdapter.deleteChat(body || {}))
      return
    }

    if (req.method === 'POST' && pathname === '/webhooks/webchat') {
      try {
        const body = await readBody(req)
        const result = await webchatAdapter.handleInbound(body)
        json(res, 202, {
          ok: true,
          status: 'accepted',
          ...result,
        })
      } catch (error) {
        json(res, 422, {
          ok: false,
          message: error instanceof Error ? error.message : 'invalid webchat payload',
        })
      }
      return
    }

    if (req.method === 'POST' && pathname === '/webhooks/email') {
      const body = await readBody(req)
      const result = await emailAdapter.handleInbound(body)
      json(res, 202, {
        ok: true,
        status: 'accepted',
        ...result,
      })
      return
    }

    if (req.method === 'POST' && pathname === '/webhooks/email/status') {
      const body = await readBody(req)
      const result = await emailAdapter.handleStatus(body)
      json(res, 202, {
        ok: true,
        status: 'accepted',
        ...result,
      })
      return
    }

    if (req.method === 'GET' && pathname === '/webhooks/meta') {
      const verification = metaAdapter.verifyWebhook(requestUrl.searchParams)
      text(res, verification.statusCode, verification.body)
      return
    }

    if (req.method === 'POST' && pathname === '/webhooks/meta') {
      const rawBody = await readRawBody(req)
      const signatureHeader =
        req.headers['x-hub-signature-256'] || req.headers['x-hub-signature']

      if (!metaAdapter.validateSignature(rawBody, signatureHeader)) {
        json(res, 401, {
          ok: false,
          message: 'invalid meta signature',
        })
        return
      }

      const body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}
      const result = await metaAdapter.handleWebhook(body)
      json(res, 202, {
        ok: true,
        status: 'accepted',
        ...result,
      })
      return
    }

    if (req.method === 'POST' && pathname === '/dispatch/meta') {
      if (!requireInternalToken(req, res)) {
        return
      }

      const body = await readBody(req)
      const result = await metaAdapter.sendOutbound(body)
      json(res, 200, {
        ok: true,
        ...result,
      })
      return
    }

    if (req.method === 'POST' && pathname === '/dispatch/whatsapp-qr') {
      if (!requireInternalToken(req, res)) {
        return
      }

      const body = await readBody(req)
      const result = await whatsappQrAdapter.sendOutbound(body)
      json(res, 200, {
        ok: true,
        ...result,
      })
      return
    }

    json(res, 404, {
      ok: false,
      service: config.service,
      message: 'route not implemented yet',
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        service: config.service,
        route: req.url,
        method: req.method,
        message: error instanceof Error ? error.message : 'unexpected channel adapter error',
      }),
    )
    json(res, 500, {
      ok: false,
      message:
        error instanceof Error ? error.message : 'unexpected channel adapter error',
    })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ service: config.service, port }))
})
