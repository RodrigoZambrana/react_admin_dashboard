import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCustomerQuoteContext,
  extractCustomerQuoteLeadText,
  extractCustomerQuotedMeasurementItems,
  extractCustomerQuotedMeasurements,
  extractCustomerQuotedQuantity,
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
    key: 'product_variant:blackout',
    label: 'blackout',
    kind: 'product_variant',
    aliases: ['blackout', 'black out'],
    familyLabel: 'cortinas',
    parentKeys: ['product_family:cortina', 'product_topic:cortinas-roller'],
    parentLabels: ['cortinas', 'cortinas roller'],
    tags: [],
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

test('extractCustomerQuotedMeasurements converges x, × and por formats into the same structural dimensions', () => {
  const [withAsciiX, withUnicodeX, withPor] = [
    'roller blackout de 2x2',
    'roller blackout de 2×2',
    'roller blackout de 2 por 2',
  ].map((value) => extractCustomerQuotedMeasurements(value))

  assert.deepEqual(
    {
      widthMm: withAsciiX?.widthMm,
      heightMm: withAsciiX?.heightMm,
      displayUnit: withAsciiX?.displayUnit,
      displayLabel: withAsciiX?.displayLabel,
    },
    {
      widthMm: withUnicodeX?.widthMm,
      heightMm: withUnicodeX?.heightMm,
      displayUnit: withUnicodeX?.displayUnit,
      displayLabel: withUnicodeX?.displayLabel,
    },
  )
  assert.deepEqual(
    {
      widthMm: withAsciiX?.widthMm,
      heightMm: withAsciiX?.heightMm,
      displayUnit: withAsciiX?.displayUnit,
      displayLabel: withAsciiX?.displayLabel,
    },
    {
      widthMm: withPor?.widthMm,
      heightMm: withPor?.heightMm,
      displayUnit: withPor?.displayUnit,
      displayLabel: withPor?.displayLabel,
    },
  )
  assert.equal(withPor?.displayLabel, '2,00 x 2,00 m')
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

test('extractCustomerQuotedMeasurementItems parses inline multi-item measurements with plain meter suffixes', () => {
  const items = extractCustomerQuotedMeasurementItems(
    'son 2 unidades de 1,50m x 2m y 2 unidades de 2m x 2m',
  )

  assert.equal(items.length, 2)
  assert.equal(items[0]?.quantity, 2)
  assert.equal(items[0]?.widthMm, 1500)
  assert.equal(items[0]?.heightMm, 2000)
  assert.equal(items[1]?.quantity, 2)
  assert.equal(items[1]?.widthMm, 2000)
  assert.equal(items[1]?.heightMm, 2000)
})

test('extractCustomerQuotedMeasurementItems does not misread exact aberturas dimensions as a quantity prefix', () => {
  const text =
    'Quiero cotización para una ventana corrediza probba color blanco con 4mm de 1819x1457'
  const items = extractCustomerQuotedMeasurementItems(text)
  const quantity = extractCustomerQuotedQuantity(text, items)

  assert.equal(items.length, 1)
  assert.equal(items[0]?.widthMm, 1819)
  assert.equal(items[0]?.heightMm, 1457)
  assert.equal(items[0]?.quantity, null)
  assert.equal(quantity, null)
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

test('buildCustomerQuoteContext resolves a transactional quote seed into topic plus measurements without reopening product intake', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText: 'pasame precio de roller blackout 2 x 2',
    topic: {
      label: 'cortinas blackout',
      type: 'product_variant',
      familyLabel: 'cortinas',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.topicRecognized, true)
  assert.equal(context?.profileResolved, true)
  assert.equal(context?.topicLabel, 'cortinas roller blackout')
  assert.equal(context?.variantLabel, 'blackout')
  assert.equal(context?.quoteSeed?.subjectText, 'roller blackout')
  assert.equal(context?.quoteSeed?.themeLabel, 'cortinas roller')
  assert.equal(context?.measurements?.displayLabel, '2,00 x 2,00 m')
  assert.deepEqual(context?.missingFields, ['quantity'])
  assert.doesNotMatch(JSON.stringify(context?.missingFields || []), /product/i)
})

test('buildCustomerQuoteContext keeps topic recognition true when the current turn has enough quote evidence despite a degraded prior topic stage', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText: 'presupuesto para roller blackout de 2 por 2',
    topic: {
      label: 'para roller blackout de 2 por 2',
      type: 'product_variant',
      familyLabel: 'cortinas',
    },
    previousTopic: {
      label: 'cortinas',
      type: 'product_family',
      familyLabel: 'cortinas',
    },
    previousQuoteContext: {
      topicLabel: 'cortinas',
      familyLabel: 'cortinas',
      topicRecognized: false,
      profileResolved: false,
      missingFields: ['measurements', 'quantity'],
      completionStatus: 'needs_info',
    },
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.topicRecognized, true)
  assert.equal(context?.profileResolved, true)
  assert.equal(context?.topicLabel, 'cortinas roller blackout')
  assert.equal(context?.quoteSeed?.topicLabel, 'cortinas roller blackout')
  assert.equal(context?.measurements?.displayLabel, '2,00 x 2,00 m')
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

test('extractCustomerQuotedQuantity captures leading product quantities without requiring the unidades word', () => {
  const quantity = extractCustomerQuotedQuantity(
    '2 cortinas roller blackout que costo tienen',
  )

  assert.equal(quantity?.total, 2)
  assert.equal(quantity?.source, 'explicit_total')
})

test('buildCustomerQuoteContext preserves the base quote topic when a follow-up only adds a variant', () => {
  const previousQuoteContext = buildCustomerQuoteContext({
    currentTurnText: 'De 2x2',
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
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  const context = buildCustomerQuoteContext({
    currentTurnText: '2 unidades blackout',
    topic: {
      label: 'blackout',
      type: 'product_variant',
      familyLabel: 'cortinas',
    },
    previousTopic: {
      label: 'cortinas roller',
      type: 'product_topic',
      familyLabel: 'cortinas',
    },
    previousQuoteContext,
    activeThread: {
      key: 'thread:product_topic:cortinas-roller',
      baseKey: 'product_topic:cortinas-roller',
      baseLabel: 'cortinas roller',
      baseType: 'product_topic',
      familyLabel: 'cortinas',
      variantLabels: ['blackout'],
      resolvedLabel: 'cortinas roller blackout',
      displayLabel: 'cortinas roller blackout',
    },
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.topicLabel, 'cortinas roller blackout')
  assert.equal(context?.variantLabel, 'blackout')
  assert.equal(context?.quantity?.total, 2)
  assert.equal(context?.measurements?.widthMm, 2000)
  assert.equal(context?.measurements?.heightMm, 2000)
})

test('buildCustomerQuoteContext restores the quote profile from the active thread after a business-fact detour', () => {
  const previousQuoteContext = buildCustomerQuoteContext({
    currentTurnText: 'Si necsito una de 2x2',
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
    currentTurnText: 'cortinas roller',
    topic: {
      label: 'medios de pago',
      type: 'business_fact',
    },
    previousTopic: {
      label: 'medios de pago',
      type: 'business_fact',
    },
    previousQuoteContext,
    activeThread: {
      key: 'thread:product_topic:cortinas-roller',
      baseKey: 'product_topic:cortinas-roller',
      baseLabel: 'cortinas roller',
      baseType: 'product_topic',
      familyLabel: 'cortinas',
      variantLabels: [],
      resolvedLabel: 'cortinas roller',
      displayLabel: 'cortinas roller',
    },
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: CUSTOMER_QUOTE_PROFILES,
  })

  assert.equal(context?.profileKey, 'quote_profile:cortinas_roller')
  assert.equal(context?.topicRecognized, true)
  assert.equal(context?.topicLabel, 'cortinas roller')
  assert.doesNotMatch(JSON.stringify(context?.missingFields || []), /product/i)
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
  assert.equal(context?.capturedAttributes?.color?.value, 'blanco')
  assert.deepEqual(context?.missingFields, [])
  assert.equal(context?.completionStatus, 'ready_for_pricing_or_handoff')
})

test('buildCustomerQuoteContext keeps inline multi-item persiana requests as ready for handoff when quantities and measurements are already present', () => {
  const context = buildCustomerQuoteContext({
    currentTurnText:
      'Buenas tardes, estoy buscando presupuesto solamente de esteras de persiana como esas, son 2 unidades de 1,50m x 2m y 2 unidades de 2m x 2m. Presupuesto en aluminio y otro con PVC, muchas gracias',
    topic: {
      label: 'persianas',
      type: 'product_family',
      familyLabel: 'persianas',
    },
    previousTopic: null,
    previousQuoteContext: null,
    tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    tenantQuoteProfiles: [
      {
        key: 'quote_profile:persianas',
        label: 'Persianas',
        appliesToTopicLabels: ['persianas'],
        familyLabel: 'persianas',
        pricingStrategy: 'handoff_only',
        closureMode: 'collect_then_handoff',
        measurementCarrierTerms: ['persiana', 'persianas', 'estera', 'esteras'],
        attributes: [
          {
            key: 'measurements',
            label: 'las medidas aproximadas (ancho por alto)',
            required: true,
            captureKind: 'measurements',
          },
          {
            key: 'quantity',
            label: 'cuántas unidades necesitás',
            required: true,
            captureKind: 'quantity',
          },
          {
            key: 'material',
            label: 'si las querés en PVC o aluminio',
            required: false,
            captureKind: 'enum',
            subjectPrefix: 'en',
            options: [
              { value: 'pvc', label: 'PVC', aliases: ['pvc'] },
              { value: 'aluminio', label: 'aluminio', aliases: ['aluminio'] },
            ],
          },
        ],
      },
    ],
  })

  assert.equal(context?.measurementItems?.length, 2)
  assert.equal(context?.quantity?.total, 4)
  assert.equal(context?.capturedAttributes?.material?.value, 'aluminio')
  assert.deepEqual(context?.missingFields, [])
  assert.equal(context?.completionStatus, 'ready_for_handoff')
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

  assert.equal(context?.capturedAttributes?.series?.value, 'probba')
  assert.equal(context?.capturedAttributes?.glass?.value, 'dvh')
  assert.equal(context?.capturedAttributes?.color?.value, 'negro')
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
  assert.equal(context?.capturedAttributes?.series?.value, '20')
  assert.equal(context?.capturedAttributes?.glass?.value, '3mm')
  assert.equal(context?.capturedAttributes?.color?.value, 'blanco')
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
  assert.equal(context?.capturedAttributes?.glass?.value, '4mm')
  assert.deepEqual(context?.missingFields, [])
  assert.equal(context?.completionStatus, 'ready_for_pricing_or_handoff')
})
