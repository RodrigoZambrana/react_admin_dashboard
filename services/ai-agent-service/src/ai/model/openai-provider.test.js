import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages'

import { OpenAIProvider } from './openai-provider.js'

test('serializes prior agent turns as AIMessage instead of ToolMessage', async () => {
  const provider = new OpenAIProvider({
    openAiApiKey: 'test-key',
    modelName: 'gpt-4o-mini',
    temperature: 0.2,
  })

  let capturedMessages = null
  provider.client = {
    invoke: async (messages) => {
      capturedMessages = messages
      return { content: 'ok', tool_calls: [] }
    },
    bindTools() {
      return this
    },
  }

  const response = await provider.generate({
    systemPrompt: 'system',
    history: [
      { role: 'customer', text: 'mensaje previo cliente' },
      { role: 'agent', text: 'respuesta previa agente' },
    ],
    input: 'mensaje actual',
    tools: [],
  })

  assert.equal(response.text, 'ok')
  assert.ok(Array.isArray(capturedMessages))
  assert.equal(capturedMessages.length, 4)
  assert.ok(capturedMessages[0] instanceof SystemMessage)
  assert.ok(capturedMessages[1] instanceof HumanMessage)
  assert.ok(capturedMessages[2] instanceof AIMessage)
  assert.ok(capturedMessages[3] instanceof HumanMessage)
})
