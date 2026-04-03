import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSemanticInfoIntent } from '../semantic-info-intent.js'

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

test('buildSemanticInfoIntent resolves explicit variant discovery without degrading the subject', () => {
  const semanticInfoIntent = buildSemanticInfoIntent({
    input: 'Me gustaria saber los tipos de cortinas roller que tienen',
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.equal(semanticInfoIntent.shape, 'variant_discovery')
  assert.equal(semanticInfoIntent.subjectMode, 'explicit')
  assert.equal(semanticInfoIntent.subjectResolution, 'resolved_subject')
  assert.equal(semanticInfoIntent.subject?.label, 'cortinas roller')
  assert.equal(semanticInfoIntent.needsSubjectFromContext, false)
  assert.equal(semanticInfoIntent.shouldSuppressRequestedTopicLabel, false)
  assert.equal(semanticInfoIntent.shouldStayInActiveThread, false)
})

test('buildSemanticInfoIntent inherits the active subject on implicit comparison follow-ups', () => {
  const semanticInfoIntent = buildSemanticInfoIntent({
    input: 'Si, dime las diferencias',
    tenantTopicTaxonomy: TAXONOMY,
    contextTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
      confidence: 0.9,
      source: 'conversation_memory',
    },
    followUpDetected: true,
  })

  assert.equal(semanticInfoIntent.shape, 'comparison')
  assert.equal(semanticInfoIntent.subjectMode, 'implicit_from_context')
  assert.equal(semanticInfoIntent.subjectResolution, 'inherit_subject')
  assert.equal(semanticInfoIntent.subject?.label, 'cortinas roller')
  assert.equal(semanticInfoIntent.comparisonRequested, true)
  assert.equal(semanticInfoIntent.needsSubjectFromContext, true)
  assert.equal(semanticInfoIntent.shouldSuppressRequestedTopicLabel, true)
  assert.equal(semanticInfoIntent.shouldStayInActiveThread, true)
})

test('buildSemanticInfoIntent suppresses generic descriptor labels instead of turning them into subjects', () => {
  const semanticInfoIntent = buildSemanticInfoIntent({
    input: 'cuales son los tipos',
    tenantTopicTaxonomy: TAXONOMY,
    contextTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
      confidence: 0.9,
      source: 'conversation_memory',
    },
    followUpDetected: true,
  })

  assert.equal(semanticInfoIntent.shape, 'variant_discovery')
  assert.equal(semanticInfoIntent.subjectMode, 'implicit_from_context')
  assert.equal(semanticInfoIntent.subject?.label, 'cortinas roller')
  assert.equal(semanticInfoIntent.shouldSuppressRequestedTopicLabel, true)
})

test('buildSemanticInfoIntent resolves general info openings from semantic policy without legacy help-term fallbacks', () => {
  const semanticInfoIntent = buildSemanticInfoIntent({
    input: 'Buenos días, quiero consultar por aberturas',
  })

  assert.equal(semanticInfoIntent.shape, 'general_info')
  assert.equal(semanticInfoIntent.subjectMode, 'explicit')
  assert.equal(semanticInfoIntent.subjectResolution, 'resolved_subject')
  assert.equal(semanticInfoIntent.subject?.label, 'aberturas')
})
