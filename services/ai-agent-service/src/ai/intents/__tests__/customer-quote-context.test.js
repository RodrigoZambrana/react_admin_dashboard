import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCustomerQuoteContext,
  extractCustomerQuoteLeadText,
  extractCustomerQuotedMeasurementItems,
  extractCustomerQuotedMeasurements,
} from '../customer-quote-context.js'

const CUSTOMER_TOPIC_TAXONOMY = [
  {
    key: 'product_family:cortina',
    label: 'cortinas',
    kind: 'product_family',
    aliases: ['cortinas', 'cortina'],
    tags: ['quote_requires_measurements', 'quote_requires_quantity'],
  },
  {
    key: 'product_topic:cortinas-roller',
    label: 'cortinas roller',
    kind: 'product_topic',
    aliases: ['cortinas roller', 'roller'],
    familyLabel: 'cortinas',
    parentKeys: ['product_family:cortina'],
    parentLabels: ['cortinas'],
    tags: ['quote_requires_measurements', 'quote_requires_quantity', 'roller'],
  },
  {
    key: 'product_family:abertura',
    label: 'aberturas',
    kind: 'product_family',
    aliases: ['aberturas', 'abertura'],
    tags: [
      'quote_requires_measurements',
      'quote_requires_quantity',
      'quote_requires_series',
      'quote_requires_glass',
      'quote_requires_color',
    ],
  },
  {
    key: 'product_topic:ventanas-corredizas',
    label: 'ventanas corredizas',
    kind: 'product_topic',
    aliases: ['ventanas corredizas', 'ventana corrediza'],
    familyLabel: 'aberturas',
    parentKeys: ['product_family:abertura'],
    parentLabels: ['aberturas'],
    tags: [
      'quote_requires_measurements',
      'quote_requires_quantity',
      'quote_requires_series',
      'quote_requires_glass',
      'quote_requires_color',
    ],
  },
  {
    key: 'product_variant:probba',
    label: 'probba',
    kind: 'product_variant',
    aliases: ['probba'],
    familyLabel: 'aberturas',
    parentKeys: ['product_family:abertura'],
    parentLabels: ['aberturas'],
    tags: ['quote_slot_series'],
  },
  {
    key: 'product_variant:dvh',
    label: 'dvh',
    kind: 'product_variant',
    aliases: ['dvh', 'doble vidrio'],
    familyLabel: 'aberturas',
    parentKeys: ['product_family:abertura'],
    parentLabels: ['aberturas'],
    tags: ['quote_slot_glass'],
  },
  {
    key: 'product_variant:serie-20',
    label: '20',
    kind: 'product_variant',
    aliases: ['20', 'serie 20', 'linea 20'],
    familyLabel: 'aberturas',
    parentKeys: ['product_topic:ventanas-corredizas', 'product_family:abertura'],
    parentLabels: ['ventanas corredizas', 'aberturas'],
    tags: ['quote_slot_series'],
  },
]

const CUSTOMER_QUOTE_PROFILES = [
  {
    key: 'quote_profile:cortinas_roller',
    label: 'Cortinas roller',
    appliesToTopicKeys: ['product_topic:cortinas-roller'],
    appliesToTopicLabels: ['cortinas roller', 'roller'],
    familyLabel: 'cortinas',
    pricingStrategy: 'immediate_square_meter',
    closureMode: 'collect_then_price_or_handoff',
    measurementCarrierTerms: ['ventana', 'ventanas', 'vano', 'vanos'],
    attributes: [
      {
        key: 'measurements',
        label: 'las medidas aproximadas (ancho por alto)',
        captureKind: 'measurements',
        required: true,
      },
      {
        key: 'quantity',
        label: 'cuántas unidades necesitás',
        captureKind: 'quantity',
        required: true,
      },
      {
        key: 'color',
        label: 'el color',
        captureKind: 'enum',
        required: false,
        subjectPrefix: 'color',
        options: [
          { value: 'blanco', aliases: ['blanco', 'blanca', 'blancos', 'blancas'] },
          { value: 'negro', aliases: ['negro', 'negra', 'negros', 'negras'] },
        ],
      },
    ],
  },
  {
    key: 'quote_profile:aberturas',
    label: 'Aberturas',
    appliesToTopicKeys: ['product_family:abertura'],
    appliesToTopicLabels: ['aberturas', 'aberturas de aluminio'],
    familyLabel: 'aberturas',
    pricingStrategy: 'parametric_exact_or_handoff',
    closureMode: 'collect_then_price_or_handoff',
    measurementCarrierTerms: ['ventana', 'ventanas', 'puerta', 'puertas', 'vano', 'vanos'],
    attributes: [
      {
        key: 'measurements',
        label: 'las medidas aproximadas (ancho por alto)',
        captureKind: 'measurements',
        required: true,
      },
      {
        key: 'quantity',
        label: 'cuántas unidades necesitás',
        captureKind: 'quantity',
        required: true,
      },
      {
        key: 'series',
        label: 'la serie',
        captureKind: 'taxonomy_tag',
        required: true,
        taxonomyTag: 'quote_slot_series',
        subjectPrefix: 'serie',
      },
      {
        key: 'glass',
        label: 'el tipo de vidrio',
        captureKind: 'enum',
        required: true,
        subjectPrefix: 'con',
        options: [
          { value: 'dvh', aliases: ['dvh', 'doble vidrio', 'doble vidriado hermetico'] },
          { value: '4mm', aliases: ['v4mm', '4mm', 'vidrio 4mm'] },
        ],
      },
      {
        key: 'color',
        label: 'el color',
        captureKind: 'enum',
        required: true,
        subjectPrefix: 'color',
        options: [
          { value: 'blanco', aliases: ['blanco', 'blanca', 'blancos', 'blancas'] },
          { value: 'negro', aliases: ['negro', 'negra', 'negros', 'negras'] },
        ],
      },
    ],
  },
  {
    key: 'quote_profile:ventanas_corredizas_publicadas',
    label: 'Ventanas corredizas publicadas',
    appliesToTopicKeys: ['product_topic:ventanas-corredizas'],
    appliesToTopicLabels: ['ventanas corredizas', 'ventana corrediza'],
    familyLabel: 'aberturas',
    pricingStrategy: 'immediate_unit_price',
    closureMode: 'collect_then_price_or_handoff',
    measurementCarrierTerms: ['ventana', 'ventanas', 'vano', 'vanos'],
    attributes: [
      {
        key: 'measurements',
        label: 'las medidas aproximadas (ancho por alto)',
        captureKind: 'measurements',
        required: true,
      },
      {
        key: 'quantity',
        label: 'cuántas unidades necesitás',
        captureKind: 'quantity',
        required: true,
      },
      {
        key: 'series',
        label: 'la serie',
        captureKind: 'taxonomy_tag',
        required: true,
        taxonomyTag: 'quote_slot_series',
        subjectPrefix: 'serie',
      },
      {
        key: 'glass',
        label: 'el tipo de vidrio',
        captureKind: 'enum',
        required: true,
        subjectPrefix: 'con',
        options: [
          { value: '3mm', aliases: ['3mm', 'vidrio 3mm'] },
          { value: '4mm', aliases: ['4mm', 'vidrio 4mm'] },
        ],
      },
      {
        key: 'color',
        label: 'el color',
        captureKind: 'enum',
        required: true,
        subjectPrefix: 'color',
        options: [
          { value: 'blanco', aliases: ['blanco', 'blanca', 'blancos', 'blancas'] },
          { value: 'negro', aliases: ['negro', 'negra', 'negros', 'negras'] },
        ],
      },
    ],
  },
]

test('extractCustomerQuotedMeasurements parses metric decimals as meters', () => {
  const result = extractCustomerQuotedMeasurements('roller de 1,20x1,20')

  assert.equal(result?.widthMm, 1200)
  assert.equal(result?.heightMm, 1200)
  assert.equal(result?.displayUnit, 'm')
  assert.equal(result?.displayLabel, '1,20 x 1,20 m')
})

test('extractCustomerQuotedMeasurements normalizes mixed metric pairs like 1,20x120 to a reasonable window size', () => {
  const result = extractCustomerQuotedMeasurements('roller de 1,20x120')

  assert.equal(result?.widthMm, 1200)
  assert.equal(result?.heightMm, 1200)
  assert.equal(result?.displayUnit, 'm')
  assert.equal(result?.displayLabel, '1,20 x 1,20 m')
})

test('extractCustomerQuotedMeasurements parses plain 1200x1200 as millimeters', () => {
  const result = extractCustomerQuotedMeasurements('abertura 1200x1200 color negro')

  assert.equal(result?.widthMm, 1200)
  assert.equal(result?.heightMm, 1200)
  assert.equal(result?.displayUnit, 'mm')
  assert.equal(result?.displayLabel, '1200 x 1200 mm')
})

test('extractCustomerQuotedMeasurementItems parses quote line items with quantities', () => {
  const items = extractCustomerQuotedMeasurementItems(`
    - 1 ventana de 2.80 x 1.90
    - 6 ventanas de 1.50 x 1.50
  `)

  assert.equal(items.length, 2)
  assert.equal(items[0]?.quantity, 1)
  assert.equal(items[0]?.widthMm, 2800)
  assert.equal(items[1]?.quantity, 6)
  assert.equal(items[1]?.widthMm, 1500)
})

test('extractCustomerQuoteLeadText stops before measurement section introducers', () => {
  const leadText = extractCustomerQuoteLeadText(`
    Buenos días. Solicito presupuesto por un total de 14 cortinas roller blancas.
    A continuación, detallo las medidas de ventanas:
    - 1 ventana de 2.80 x 1.90
  `)

  assert.doesNotMatch(leadText, /ventanas/i)
  assert.match(leadText, /14 cortinas roller blancas/i)
})

test('buildCustomerQuoteContext preserves measurement requirements from tenant taxonomy and asks only for missing quantity', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText: 'seria de 1,20x1,20',
    topic: {
      label: 'cortinas roller',
      type: 'product_topic',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.requiresMeasurements, true)
  assert.equal(context?.familyLabel, 'cortinas')
  assert.equal(context?.measurements?.widthMm, 1200)
  assert.deepEqual(context?.requiredFields, ['measurements', 'quantity'])
  assert.deepEqual(context?.missingFields, ['quantity'])
})

test('buildCustomerQuoteContext captures a bare quantity follow-up when the previous quote already has measurements', () => {
  const previousQuoteContext = buildCustomerQuoteContext({
    currentTurnText: 'seria de 1,20x120',
    topic: {
      label: 'cortinas roller',
      type: 'product_topic',
      familyLabel: 'cortinas',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  const context = buildCustomerQuoteContext({
    currentTurnText: '2',
    topic: {
      label: 'cortinas roller',
      type: 'product_topic',
      familyLabel: 'cortinas',
    },
    previousTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
      familyLabel: 'cortinas',
    },
    previousQuoteContext,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.measurements?.widthMm, 1200)
  assert.equal(context?.measurements?.heightMm, 1200)
  assert.equal(context?.quantity?.total, 2)
  assert.equal(context?.quantity?.source, 'bare_follow_up')
  assert.deepEqual(context?.missingFields, [])
  assert.equal(context?.completionStatus, 'ready_for_pricing_or_handoff')
})

test('buildCustomerQuoteContext marks multi-item quote intake as ready for handoff once minimum fields are complete', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText: `
      Presupuesto por un total de 14 cortinas roller blancas.
      - 1 ventana de 2.80 x 1.90
      - 6 ventanas de 1.50 x 1.50
      - 1 ventana de 0.90 x 1.50
      - 4 ventanas de 2.00 x 1.50
      - 1 ventana de 1.00 x 1.00
      - 1 ventana de 1.70 x 1.60
    `,
    topic: {
      label: 'cortinas roller',
      type: 'product_topic',
      familyLabel: 'cortinas',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.quantity?.total, 14)
  assert.equal(context?.measurementItems?.length, 6)
  assert.equal(context?.color, 'blanco')
  assert.deepEqual(context?.missingFields, [])
  assert.equal(context?.completionStatus, 'ready_for_pricing_or_handoff')
})

test('buildCustomerQuoteContext derives aberturas series, glass and color slots from taxonomy plus text', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText: 'quiero una abertura probba con doble vidrio color negro de 1.10 x 1.20',
    topic: {
      label: 'aberturas',
      type: 'product_family',
      familyLabel: 'aberturas',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.series, 'probba')
  assert.equal(context?.glass, 'dvh')
  assert.equal(context?.color, 'negro')
  assert.equal(context?.quantity?.total, 1)
  assert.deepEqual(context?.missingFields, [])
  assert.equal(context?.completionStatus, 'ready_for_pricing_or_handoff')
})

test('buildCustomerQuoteContext prefers a specific published topic profile over the parent family profile', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText:
      'Quiero cotización para una ventana corrediza 20 blanco 3mm de 1500x1500',
    topic: {
      label: 'ventanas corredizas 20',
      type: 'product_variant',
      familyLabel: 'aberturas',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.profileKey, 'quote_profile:ventanas_corredizas_publicadas')
  assert.equal(context?.pricingStrategy, 'immediate_unit_price')
  assert.equal(context?.series, '20')
  assert.equal(context?.glass, '3mm')
  assert.equal(context?.color, 'blanco')
  assert.equal(context?.quantity?.total, 1)
  assert.equal(context?.measurements?.widthMm, 1500)
  assert.deepEqual(context?.missingFields, [])
})

test('buildCustomerQuoteContext infers single configured item quantity and generic glass thickness from the same turn', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText:
      'Quiero cotización para una corrediza serie probba blanco v4mm de 110 x 120',
    topic: {
      label: 'aberturas',
      type: 'product_family',
      familyLabel: 'aberturas',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.quantity?.total, 1)
  assert.equal(context?.quantity?.source, 'implicit_single_item')
  assert.equal(context?.glass, '4mm')
  assert.deepEqual(context?.missingFields, [])
  assert.equal(context?.completionStatus, 'ready_for_pricing_or_handoff')
})
