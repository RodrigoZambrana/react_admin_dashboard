export function loadConfig() {
  return {
    service: 'ai-agent-service',
    port: Number(process.env.PORT || 4100),
    nodeEnv: process.env.NODE_ENV || 'development',
    backendBaseUrl: process.env.BACKEND_BASE_URL || 'http://backend:4000/api',
    conversationsBaseUrl:
      process.env.CONVERSATIONS_BASE_URL ||
      'http://backend:4000/api/conversations',
    aiInternalToken:
      process.env.AI_INTERNAL_TOKEN || 'local-ai-internal-token',
    modelProvider: process.env.AI_MODEL_PROVIDER || 'openai',
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o-mini',
    openAiApiKey: process.env.OPENAI_API_KEY || '',
    memoryDriver: process.env.AI_MEMORY_DRIVER || 'redis',
    redisEnabled: (process.env.REDIS_ENABLED || 'true') === 'true',
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
    temperature: Number(process.env.AI_TEMPERATURE || 0.2),
  }
}
