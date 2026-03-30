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
    openAiTimeoutMs: Number(process.env.AI_OPENAI_TIMEOUT_MS || 25000),
    openAiMaxRetries: Number(process.env.AI_OPENAI_MAX_RETRIES || 2),
    openAiMaxOutputTokens: Number(process.env.AI_OPENAI_MAX_OUTPUT_TOKENS || 280),
    openAiTopP: Number(process.env.AI_OPENAI_TOP_P || 1),
    openAiFrequencyPenalty: Number(process.env.AI_OPENAI_FREQUENCY_PENALTY || 0),
    openAiPresencePenalty: Number(process.env.AI_OPENAI_PRESENCE_PENALTY || 0),
    openAiInterpretationModel:
      process.env.AI_OPENAI_INTERPRETATION_MODEL || process.env.AI_MODEL_NAME || 'gpt-4o-mini',
    openAiDecisionModel:
      process.env.AI_OPENAI_DECISION_MODEL ||
      process.env.AI_OPENAI_INTERPRETATION_MODEL ||
      process.env.AI_MODEL_NAME ||
      'gpt-4o-mini',
    openAiResponseModel:
      process.env.AI_OPENAI_RESPONSE_MODEL || process.env.AI_MODEL_NAME || 'gpt-4o-mini',
    openAiRewriteModel:
      process.env.AI_OPENAI_REWRITE_MODEL || process.env.AI_MODEL_NAME || 'gpt-4o-mini',
    openAiInterpretationTemperature: Number(
      process.env.AI_OPENAI_INTERPRETATION_TEMPERATURE || 0,
    ),
    openAiDecisionTemperature: Number(
      process.env.AI_OPENAI_DECISION_TEMPERATURE ||
        process.env.AI_OPENAI_INTERPRETATION_TEMPERATURE ||
        0,
    ),
    openAiResponseTemperature: Number(
      process.env.AI_OPENAI_RESPONSE_TEMPERATURE || 0.45,
    ),
    openAiRewriteTemperature: Number(
      process.env.AI_OPENAI_REWRITE_TEMPERATURE || 0.35,
    ),
    memoryDriver: process.env.AI_MEMORY_DRIVER || 'redis',
    redisEnabled: (process.env.REDIS_ENABLED || 'true') === 'true',
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
    temperature: Number(process.env.AI_TEMPERATURE || 0.2),
  }
}
