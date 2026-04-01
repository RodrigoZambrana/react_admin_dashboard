import test from 'node:test'
import assert from 'node:assert/strict'

import { handleConversationalMode } from '../handle-conversational-mode.js'

test('handleConversationalMode forwards compact task context and a wider recent history window', async () => {
  let capturedSystemPrompt = ''
  let capturedHistory = []
  let capturedInput = ''

  const result = await handleConversationalMode({
    provider: {
      async generate({ systemPrompt, history, input }) {
        capturedSystemPrompt = systemPrompt
        capturedHistory = history
        capturedInput = input
        return {
          text: 'Te cuento las opciones y vemos cuál te conviene más.',
        }
      },
    },
    role: 'customer_public',
    input: 'Quiero saber qué opciones tienen',
    recentTurns: [
      { role: 'customer', text: 'Hola' },
      { role: 'agent', text: 'Hola. ¿En qué podemos ayudarte hoy?' },
      { role: 'customer', text: 'Necesito cortinas roller blackout' },
      { role: 'agent', text: 'Perfecto. Decime las medidas aproximadas.' },
      { role: 'customer', text: '2x2' },
      { role: 'agent', text: 'Bien. ¿Cuántas unidades necesitás?' },
      { role: 'customer', text: '2 unidades' },
    ],
    interpretation: {
      threadResolution: {
        activeThread: {
          resolvedLabel: 'cortinas roller blackout',
        },
      },
      conversationContext: {
        mode: 'exploration',
        activeDomain: 'quote',
        nextUsefulField: 'variant',
        responseStrategy: 'guide_quote_exploration',
        knownFacts: {
          topic: 'cortinas roller blackout',
          quantity: 2,
          measurements: '2,00 x 2,00 m',
        },
      },
      quoteContext: {
        missingFields: ['variant'],
      },
      followUp: {
        detected: true,
      },
    },
    approvedDraft:
      'Dentro de roller blackout hay varias líneas. Si querés, te resumo las opciones principales.',
    approvedFacts: ['Tema actual: cortinas roller blackout.'],
    taskSummary:
      'intención=customer.quote ; medidas=2,00 x 2,00 m ; cantidad=2 ; consulta_actual=Quiero saber qué opciones tienen',
    currentTask: {
      intentKey: 'customer.quote',
      status: 'open',
      entities: [
        { type: 'topic', value: 'cortinas roller blackout' },
        { type: 'quote_quantity', value: '2' },
      ],
    },
  })

  assert.equal(result?.source, 'llm_conversational')
  assert.match(capturedSystemPrompt, /Contexto conversacional compacto:/i)
  assert.match(capturedSystemPrompt, /Resumen operativo:/i)
  assert.match(capturedSystemPrompt, /Hilo activo: cortinas roller blackout\./i)
  assert.match(capturedSystemPrompt, /Última guía o pregunta del sistema: Bien\. ¿Cuántas unidades necesitás\?/i)
  assert.equal(capturedHistory.length, 6)
  assert.match(capturedInput, /Borrador aprobado por backend:/i)
})
