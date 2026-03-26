import http from 'node:http'

import { AiAgentRuntime } from './ai/agent.js'
import { InMemoryConversationStore } from './ai/memory/in-memory-conversation-store.js'
import { RedisConversationStore } from './ai/memory/redis-conversation-store.js'
import { createModelProvider } from './ai/model/provider-factory.js'
import { BackendAiClient } from './clients/backend-ai.client.js'
import { loadConfig } from './config/env.js'

const config = loadConfig()

const json = (res, statusCode, body) => {
  res.writeHead(statusCode, { 'content-type': 'application/json' })
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

const memoryStore =
  config.redisEnabled && config.memoryDriver === 'redis'
    ? new RedisConversationStore(config.redisUrl)
    : new InMemoryConversationStore()

const runtime = new AiAgentRuntime({
  config,
  provider: createModelProvider(config),
  memoryStore,
  backendClient: new BackendAiClient(config),
})

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    json(res, 404, { ok: false })
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, {
      status: 'ok',
      service: config.service,
      memoryDriver: config.memoryDriver,
      redisEnabled: config.redisEnabled,
      provider: runtime.provider.providerName,
      model: runtime.provider.modelName,
      timestamp: new Date().toISOString(),
    })
    return
  }

  if (req.method === 'GET' && req.url === '/capabilities') {
    json(res, 200, {
      scope: ['customer_public', 'customer_authenticated', 'admin_internal'],
      roles: [
        'customer_public',
        'customer_authenticated',
        'admin_support',
        'admin_sales',
        'admin_operations',
        'admin_supervisor',
        'superadmin',
      ],
      tools: [
        'search_products',
        'create_customer',
        'create_appointment',
        'create_product',
        'create_order',
        'create_quote',
        'create_payment',
      ],
      model: {
        provider: runtime.provider.providerName,
        name: runtime.provider.modelName,
      },
      memory: {
        driver: config.memoryDriver,
        redisEnabled: config.redisEnabled,
      },
    })
    return
  }

  if (req.method === 'POST' && req.url === '/respond') {
    try {
      const body = await readBody(req)
      const response = await runtime.respond(body)
      json(res, 200, { ok: true, response })
    } catch (error) {
      json(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : 'unknown error',
      })
    }
    return
  }

  if (req.method === 'GET' && req.url === '/config') {
    json(res, 200, {
      ...config,
      openAiApiKey: config.openAiApiKey ? 'configured' : '',
    })
    return
  }

  if (req.method === 'POST' && req.url === '/cache/refresh') {
    const token = req.headers['x-ai-internal-token']
    if (token !== config.aiInternalToken) {
      json(res, 401, { ok: false, message: 'unauthorized' })
      return
    }

    try {
      await runtime.invalidateCaches({ refreshRuntime: true })
      json(res, 200, {
        ok: true,
        provider: runtime.provider.providerName,
        model: runtime.provider.modelName,
        refreshedAt: new Date().toISOString(),
      })
    } catch (error) {
      json(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : 'refresh failed',
      })
    }
    return
  }

  json(res, 404, {
    ok: false,
    service: config.service,
    message: 'route not implemented yet',
  })
})

server.listen(config.port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      service: config.service,
      port: config.port,
      provider: runtime.provider.providerName,
      model: runtime.provider.modelName,
      memoryDriver: config.memoryDriver,
      redisEnabled: config.redisEnabled,
    }),
  )
})
