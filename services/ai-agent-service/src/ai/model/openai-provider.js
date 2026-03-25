import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'

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
          ? new ToolMessage({
              content: item.text,
              tool_call_id: item.toolCallId || 'memory',
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
      const result = await targetTool.invoke(toolCall.args)
      toolResults.push({
        name: toolCall.name,
        arguments: toolCall.args,
        result,
        toolCallId: toolCall.id,
      })
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
                : JSON.stringify(item.result),
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
      })),
    }
  }
}
