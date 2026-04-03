import test from 'node:test'
import assert from 'node:assert/strict'

import { selectCustomerFaqEvidence } from '../customer-faq-response.js'

test('selectCustomerFaqEvidence prefers product evidence over business hours on implicit comparison follow-ups', () => {
  const evidence = selectCustomerFaqEvidence({
    input: 'Si, dime las diferencias',
    faqSubtype: 'variants',
    retrievalItems: [
      {
        id: 'business-hours',
        title: 'Horario',
        snippet: 'Nuestro horario de atención es Lun - Vie, 10:00 - 18:00.',
        metadata: {
          factType: 'business_hours',
          pageKinds: ['business_hours_page'],
        },
      },
      {
        id: 'roller-knowledge',
        title: 'Cortinas Roller',
        snippet:
          'Las cortinas roller se pueden clasificar en dos tipos según el pasaje de luz que permiten.',
        metadata: {
          factType: 'product_info',
          pageKinds: ['product_page'],
        },
      },
    ],
    interpretation: {
      semanticInfoIntent: {
        shape: 'comparison',
        subjectMode: 'implicit_from_context',
        subjectResolution: 'inherit_subject',
        subject: {
          label: 'cortinas roller',
          type: 'product_topic',
          confidence: 0.85,
        },
        shouldSuppressRequestedTopicLabel: true,
      },
      topic: {
        label: 'cortinas roller',
        type: 'product_topic',
      },
      contextTopic: {
        label: 'cortinas roller',
        type: 'product_topic',
      },
    },
  })

  assert.ok(evidence.length > 0)
  assert.match(evidence[0].text, /cortinas roller/i)
  assert.doesNotMatch(evidence[0].text, /horario de atencion/i)
})

test('selectCustomerFaqEvidence prioritizes semantic subject resolution over conflicting inherited topic labels', () => {
  const evidence = selectCustomerFaqEvidence({
    input: 'cuales son los tipos',
    faqSubtype: 'variants',
    retrievalItems: [
      {
        id: 'aberturas-knowledge',
        title: 'Aberturas',
        snippet: 'Las aberturas pueden configurarse en hojas corredizas y paños fijos.',
        metadata: {
          factType: 'product_info',
          pageKinds: ['product_page'],
        },
      },
      {
        id: 'roller-knowledge',
        title: 'Cortinas Roller',
        snippet:
          'Las cortinas roller se pueden clasificar en dos tipos según el pasaje de luz que permiten.',
        metadata: {
          factType: 'product_info',
          pageKinds: ['product_page'],
        },
      },
    ],
    interpretation: {
      semanticInfoIntent: {
        shape: 'variant_discovery',
        subjectMode: 'implicit_from_context',
        subjectResolution: 'inherit_subject',
        subject: {
          label: 'cortinas roller',
          type: 'product_topic',
          confidence: 0.85,
        },
        shouldSuppressRequestedTopicLabel: true,
      },
      topic: {
        label: 'aberturas',
        type: 'product_topic',
      },
      contextTopic: {
        label: 'aberturas',
        type: 'product_topic',
      },
    },
  })

  assert.ok(evidence.length > 0)
  assert.match(evidence[0].text, /cortinas roller/i)
  assert.doesNotMatch(evidence[0].text, /aberturas pueden configurarse/i)
})
