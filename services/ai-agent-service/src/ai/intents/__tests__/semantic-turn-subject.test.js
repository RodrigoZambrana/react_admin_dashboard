import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSemanticTurnSubject,
  extractExplicitSemanticSubject,
  isGenericSemanticSubjectLabel,
} from '../semantic-turn-subject.js'

const TAXONOMY = [
  {
    key: 'product_family:cortina',
    label: 'cortinas',
    kind: 'product_family',
    aliases: ['cortinas', 'cortina'],
    familyLabel: 'cortinas',
  },
  {
    key: 'product_topic:cortinas-roller',
    label: 'cortinas roller',
    kind: 'product_topic',
    aliases: ['cortinas roller', 'roller'],
    parentKeys: ['product_family:cortina'],
    parentLabels: ['cortinas'],
    familyLabel: 'cortinas',
  },
]

test('extractExplicitSemanticSubject suppresses generic descriptor labels instead of turning them into subjects', () => {
  assert.equal(isGenericSemanticSubjectLabel('cuales son los tipos'), true)

  const result = extractExplicitSemanticSubject({
    input: 'dime las opciones',
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.equal(result.explicitSubject, null)
  assert.equal(result.suppressed, false)
})

test('extractExplicitSemanticSubject captures product subjects on quote-expansion follow-ups', () => {
  const result = extractExplicitSemanticSubject({
    input: 'Tengo que pasarte un roller más',
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.equal(result.explicitSubject?.label, 'cortinas roller')
})

test('extractExplicitSemanticSubject suppresses non-subject operational/noise payloads', () => {
  assert.equal(
    extractExplicitSemanticSubject({
      input: 'IMG-20260318-WA0007.jpg (archivo adjunto)',
      tenantTopicTaxonomy: TAXONOMY,
    }).suppressed,
    true,
  )
  assert.equal(
    extractExplicitSemanticSubject({
      input: 'Perdón, me quedó para atrás el mensaje',
      tenantTopicTaxonomy: TAXONOMY,
    }).suppressed,
    true,
  )
  assert.equal(
    extractExplicitSemanticSubject({
      input: 'Este viernes en la mañana pueden ir a mi domicilio?',
      tenantTopicTaxonomy: TAXONOMY,
    }).suppressed,
    true,
  )
  assert.equal(
    extractExplicitSemanticSubject({
      input: 'necesito 2',
      tenantTopicTaxonomy: TAXONOMY,
    }).suppressed,
    true,
  )
})

test('buildSemanticTurnSubject can inherit the active subject when the flow allows context carry', () => {
  const result = buildSemanticTurnSubject({
    input: 'Si, dime las diferencias',
    tenantTopicTaxonomy: TAXONOMY,
    contextTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
      confidence: 0.9,
      source: 'conversation_memory',
    },
    followUpDetected: true,
    shape: 'comparison',
    allowContextCarry: true,
  })

  assert.equal(result.subjectMode, 'implicit_from_context')
  assert.equal(result.subjectResolution, 'inherit_subject')
  assert.equal(result.subject?.label, 'cortinas roller')
})
