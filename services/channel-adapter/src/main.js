import http from 'node:http'

import { AiAgentClient } from './clients/ai-agent.client.js'
import { BackendConversationsClient } from './clients/backend-conversations.client.js'
import { EmailAdapter } from './channels/email/email.adapter.js'
import { MetaAdapter } from './channels/meta/meta.adapter.js'
import { WebchatAdapter } from './channels/webchat/webchat.adapter.js'

const port = Number(process.env.PORT || 4200)

const config = {
  service: 'channel-adapter',
  nodeEnv: process.env.NODE_ENV || 'development',
  backendBaseUrl: process.env.BACKEND_BASE_URL || 'http://backend:4000/api',
  aiAgentBaseUrl: process.env.AI_AGENT_BASE_URL || 'http://ai-agent-service:4100',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  internalToken: process.env.AI_INTERNAL_TOKEN || 'local-ai-internal-token',
  metaVerifyToken: process.env.META_VERIFY_TOKEN || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  messengerPageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN || '',
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

const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (!chunks.length) {
    return null
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const clients = {
  conversations: new BackendConversationsClient(config),
  ai: new AiAgentClient(config),
}

const webchatAdapter = new WebchatAdapter(clients)
const emailAdapter = new EmailAdapter(clients)
const metaAdapter = new MetaAdapter(clients, config)

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    json(res, 404, { ok: false })
    return
  }

  if (req.method === 'OPTIONS') {
    json(res, 200, { ok: true })
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, {
      status: 'ok',
      service: config.service,
      timestamp: new Date().toISOString(),
    })
    return
  }

  if (req.method === 'GET' && req.url === '/channels') {
    json(res, 200, {
      channels: ['webchat', 'email', 'whatsapp', 'instagram', 'messenger'],
    })
    return
  }

  if (req.method === 'POST' && req.url === '/webhooks/webchat') {
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

  if (req.method === 'POST' && req.url === '/webhooks/email') {
    const body = await readBody(req)
    const result = await emailAdapter.handleInbound(body)
    json(res, 202, {
      ok: true,
      status: 'accepted',
      ...result,
    })
    return
  }

  if (req.method === 'POST' && req.url === '/webhooks/email/status') {
    const body = await readBody(req)
    const result = await emailAdapter.handleStatus(body)
    json(res, 202, {
      ok: true,
      status: 'accepted',
      ...result,
    })
    return
  }

  if (req.method === 'POST' && req.url === '/webhooks/meta') {
    const body = await readBody(req)
    const hasStatuses =
      Array.isArray(body?.statuses) ||
      Boolean(
        body?.entry?.some((entry) =>
          (entry?.changes || []).some(
            (change) => Array.isArray(change?.value?.statuses) && change.value.statuses.length,
          ),
        ),
      )
    const result =
      hasStatuses
        ? await metaAdapter.handleStatus(body)
        : await metaAdapter.handleInbound(body)
    json(res, 202, {
      ok: true,
      status: 'accepted',
      ...result,
    })
    return
  }

  if (req.method === 'POST' && req.url === '/dispatch/meta') {
    const token = req.headers['x-ai-internal-token']
    if (token !== config.internalToken) {
      json(res, 401, {
        ok: false,
        message: 'unauthorized',
      })
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

  json(res, 404, {
    ok: false,
    service: config.service,
    message: 'route not implemented yet',
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ service: config.service, port }))
})
