import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCustomerTextForIntent } from '../customer-text-normalizer.js'

const CUSTOMER_TOPIC_TAXONOMY = [
  {
    key: 'product_family:cortina',
    label: 'cortinas',
    kind: 'product_family',
    aliases: ['cortinas', 'cortina', 'cortnas', 'crtinas'],
    normalizationValue: 'cortinas',
  },
  {
    key: 'product_topic:cortinas-roller',
    label: 'cortinas roller',
    kind: 'product_topic',
    aliases: ['cortinas roller', 'roller', 'roler'],
    normalizationValue: 'roller',
  },
  {
    key: 'product_variant:blackout',
    label: 'blackout',
    kind: 'product_variant',
    aliases: ['blackout', 'black out', 'balckout'],
    normalizationValue: 'blackout',
  },
  {
    key: 'product_variant:dvh',
    label: 'dvh',
    kind: 'product_variant',
    aliases: ['dvh', 'doble vidrio hermetico', 'doble vidriado hermetico'],
    normalizationValue: 'dvh',
  },
]

test('normalizeCustomerTextForIntent expands abbreviations and common business typos', () => {
  const result = normalizeCustomerTextForIntent(
    'aceptan transf o tc? necesito info de ubicaion',
  )

  assert.equal(
    result.normalizedInput,
    'aceptan transferencia o tarjeta necesito informacion de ubicacion',
  )
  assert.equal(result.changed, true)
  assert.deepEqual(
    result.operations.map((entry) => entry.key),
    ['abbreviation_info', 'abbreviation_transfer', 'abbreviation_card', 'typo_location'],
  )
})

test('normalizeCustomerTextForIntent separates obvious glued phrases and voice to text variants', () => {
  const result = normalizeCustomerTextForIntent(
    'hola buenosdias queria saver si atienden oy y dondeestan',
  )

  assert.equal(
    result.normalizedInput,
    'hola buenos dias queria saber si atienden hoy y donde estan',
  )
  assert.equal(result.changed, true)
  assert.deepEqual(
    result.operations.map((entry) => entry.key),
    ['glued_greeting_morning', 'glued_location', 'typo_know', 'typo_today'],
  )
})

test('normalizeCustomerTextForIntent normalizes domain variants for products and materials', () => {
  const result = normalizeCustomerTextForIntent(
    'quiero saber si tienen roler black out y doble vidrio hermetico',
    {
      tenantTopicTaxonomy: CUSTOMER_TOPIC_TAXONOMY,
    },
  )

  assert.equal(
    result.normalizedInput,
    'quiero saber si tienen roller blackout y dvh',
  )
  assert.equal(result.changed, true)
  assert.deepEqual(
    result.operations.map((entry) => entry.key).sort(),
    [
      'taxonomy_alias:product_topic:cortinas-roller',
      'taxonomy_alias:product_variant:blackout',
      'taxonomy_alias:product_variant:dvh',
    ].sort(),
  )
})

test('normalizeCustomerTextForIntent does not duplicate the family when a topic alias appears inside an already scoped phrase', () => {
  const result = normalizeCustomerTextForIntent(
    'quiero saber sobre aberturas en aluminio',
    {
      tenantTopicTaxonomy: [
        {
          key: 'product_family:aberturas',
          label: 'aberturas',
          kind: 'product_family',
          aliases: ['aberturas', 'abertruas', 'abrturas'],
          normalizationValue: 'aberturas',
        },
        {
          key: 'product_topic:aberturas-aluminio',
          label: 'aberturas de aluminio',
          kind: 'product_topic',
          aliases: ['aluminio', 'aberturas aluminio', 'aberturas de aluminio'],
          familyLabel: 'aberturas',
          normalizationValue: 'aberturas de aluminio',
        },
      ],
    },
  )

  assert.equal(result.normalizedInput, 'quiero saber sobre aberturas en aluminio')
  assert.equal(result.operations.some((entry) => entry.key.includes('aberturas-aluminio')), false)
})
