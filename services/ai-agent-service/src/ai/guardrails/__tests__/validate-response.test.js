import test from 'node:test'
import assert from 'node:assert/strict'

import { validateResponseGuardrails } from '../validate-response.js'

test('validateResponseGuardrails injects a question in exploration mode when missing', () => {
  const result = validateResponseGuardrails({
    text: 'Podemos orientarte con opciones de roller screen y blackout.',
    mode: 'exploration',
    maxChars: 180,
  })

  assert.match(result.text, /\?/u)
  assert.ok(result.issues.includes('missing_question'))
})

test('validateResponseGuardrails falls back when text is empty', () => {
  const result = validateResponseGuardrails({
    text: '',
    fallbackText: 'Contame un poco más y te ayudo.',
    mode: 'unclear',
    maxChars: 180,
  })

  assert.ok(result.text.length > 0)
})
