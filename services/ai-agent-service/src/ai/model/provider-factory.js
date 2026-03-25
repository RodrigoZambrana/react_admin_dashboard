import { MockProvider } from './mock-provider.js'
import { OpenAIProvider } from './openai-provider.js'

export function createModelProvider(config) {
  if (config.modelProvider === 'openai' && config.openAiApiKey) {
    return new OpenAIProvider(config)
  }

  return new MockProvider(config)
}
