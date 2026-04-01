import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

import { recordProviderCall } from './provider-call-trace.js'

const flattenTextContent = (content) => {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const text = content
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry
        }
        if (entry && typeof entry === 'object') {
          if (typeof entry.text === 'string') {
            return entry.text
          }
          if (typeof entry.content === 'string') {
            return entry.content
          }
        }
        return ''
      })
      .filter(Boolean)
      .join(' ')
      .trim()

    if (text) {
      return text
    }
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') {
      return content.text
    }
    if (typeof content.content === 'string') {
      return content.content
    }
  }

  return JSON.stringify(content)
}

export class OpenAIProvider {
  constructor(config) {
    this.providerName = 'openai'
    this.modelName = config.modelName
    this.config = {
      openAiApiKey: config.openAiApiKey,
      modelName: config.modelName,
      temperature: config.temperature,
      topP: config.openAiTopP,
      frequencyPenalty: config.openAiFrequencyPenalty,
      presencePenalty: config.openAiPresencePenalty,
      timeout: config.openAiTimeoutMs,
      maxRetries: config.openAiMaxRetries,
      maxOutputTokens: config.openAiMaxOutputTokens,
    }
    this.client = this.createClient()
  }

  createClient(overrides = {}) {
    const nextConfig = {
      ...this.config,
      ...overrides,
    }

    return new ChatOpenAI({
      apiKey: nextConfig.openAiApiKey,
      model: nextConfig.modelName,
      temperature: nextConfig.temperature,
      topP:
        typeof nextConfig.topP === 'number' && Number.isFinite(nextConfig.topP)
          ? nextConfig.topP
          : undefined,
      frequencyPenalty:
        typeof nextConfig.frequencyPenalty === 'number' &&
        Number.isFinite(nextConfig.frequencyPenalty)
          ? nextConfig.frequencyPenalty
          : undefined,
      presencePenalty:
        typeof nextConfig.presencePenalty === 'number' &&
        Number.isFinite(nextConfig.presencePenalty)
          ? nextConfig.presencePenalty
          : undefined,
      timeout: nextConfig.timeout,
      maxRetries: nextConfig.maxRetries,
      maxTokens:
        typeof nextConfig.maxOutputTokens === 'number' &&
        Number.isFinite(nextConfig.maxOutputTokens)
          ? nextConfig.maxOutputTokens
          : undefined,
    })
  }

  resolveClient(options = {}) {
    if (!options || Object.keys(options).length === 0) {
      return this.client
    }

    return this.createClient({
      modelName: options.modelName || this.config.modelName,
      temperature:
        typeof options.temperature === 'number'
          ? options.temperature
          : this.config.temperature,
      maxOutputTokens:
        typeof options.maxOutputTokens === 'number'
          ? options.maxOutputTokens
          : this.config.maxOutputTokens,
      topP:
        typeof options.topP === 'number' ? options.topP : this.config.topP,
      frequencyPenalty:
        typeof options.frequencyPenalty === 'number'
          ? options.frequencyPenalty
          : this.config.frequencyPenalty,
      presencePenalty:
        typeof options.presencePenalty === 'number'
          ? options.presencePenalty
          : this.config.presencePenalty,
      timeout:
        typeof options.timeout === 'number' ? options.timeout : this.config.timeout,
      maxRetries:
        typeof options.maxRetries === 'number'
          ? options.maxRetries
          : this.config.maxRetries,
    })
  }

  async generate({ systemPrompt, history, input, tools, options = {} }) {
    recordProviderCall({
      method: 'generate',
      stage: options?.stage || null,
      provider: this.providerName,
      model: this.modelName,
    })
    const client = this.resolveClient(options)
    const messages = [
      new SystemMessage(systemPrompt),
      ...history.map((item) =>
        item.role === 'agent'
          ? new AIMessage({
              content: item.text,
            })
          : new HumanMessage(`${item.role}: ${item.text}`),
      ),
      new HumanMessage(input),
    ]

    const runnable = tools?.length ? client.bindTools(tools) : client
    const first = await runnable.invoke(messages)
    const toolCalls = first.tool_calls ?? []

    if (!toolCalls.length) {
      return {
        text: flattenTextContent(first.content),
        toolCalls: [],
      }
    }

    const toolResults = []
    for (const toolCall of toolCalls) {
      const targetTool = tools.find((tool) => tool.name === toolCall.name)
      if (!targetTool) {
        continue
      }
      try {
        const result = await targetTool.invoke(toolCall.args)
        toolResults.push({
          name: toolCall.name,
          arguments: toolCall.args,
          result,
          toolCallId: toolCall.id,
          status: 'executed',
        })
      } catch (error) {
        toolResults.push({
          name: toolCall.name,
          arguments: toolCall.args,
          result: null,
          toolCallId: toolCall.id,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'tool failed',
        })
      }
    }

    const second = await client.invoke([
      ...messages,
      first,
      ...toolResults.map(
        (item) =>
          new ToolMessage({
            tool_call_id: item.toolCallId,
            content:
              typeof item.result === 'string'
                ? item.result
                : JSON.stringify(
                    item.status === 'failed'
                      ? { error: item.errorMessage || 'tool failed' }
                      : item.result,
                  ),
          }),
      ),
    ])

    return {
      text: flattenTextContent(second.content),
      toolCalls: toolResults.map((item) => ({
        name: item.name,
        arguments: item.arguments,
        result: item.result,
        status: item.status,
        errorMessage: item.errorMessage,
      })),
    }
  }

  async extractStructured({ systemPrompt, input, schema, options = {} }) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('structured extraction schema is required')
    }

    recordProviderCall({
      method: 'extractStructured',
      stage: options?.stage || null,
      provider: this.providerName,
      model: this.modelName,
    })
    const targetSchema = z.object(schema)
    const client = this.resolveClient(options)
    const runnable = client.withStructuredOutput(targetSchema, {
      name: 'structured_extraction',
    })

    const result = await runnable.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(input),
    ])

    return result
  }
}
