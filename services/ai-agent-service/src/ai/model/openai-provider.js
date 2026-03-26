import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

export class OpenAIProvider {
  constructor(config) {
    this.providerName = 'openai'
    this.modelName = config.modelName
    this.client = new ChatOpenAI({
      apiKey: config.openAiApiKey,
      model: config.modelName,
      temperature: config.temperature,
    })
  }

  async generate({ systemPrompt, history, input, tools }) {
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

    const runnable = tools?.length ? this.client.bindTools(tools) : this.client
    const first = await runnable.invoke(messages)
    const toolCalls = first.tool_calls ?? []

    if (!toolCalls.length) {
      return {
        text:
          typeof first.content === 'string'
            ? first.content
            : JSON.stringify(first.content),
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

    const second = await this.client.invoke([
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
      text:
        typeof second.content === 'string'
          ? second.content
          : JSON.stringify(second.content),
      toolCalls: toolResults.map((item) => ({
        name: item.name,
        arguments: item.arguments,
        result: item.result,
        status: item.status,
        errorMessage: item.errorMessage,
      })),
    }
  }

  async extractStructured({ systemPrompt, input, schema }) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('structured extraction schema is required')
    }

    const targetSchema = z.object(schema)
    const runnable = this.client.withStructuredOutput(targetSchema, {
      name: 'structured_extraction',
    })

    const result = await runnable.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(input),
    ])

    return result
  }
}
