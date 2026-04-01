import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConversationThreads } from '../conversation-thread-resolver.js'

const TAXONOMY = [
  {
    key: 'product_family:cortina',
    label: 'cortinas',
    kind: 'product_family',
    aliases: ['cortinas', 'cortina'],
    familyLabel: 'cortinas',
  },
  {
    key: 'product_family:abertura',
    label: 'aberturas',
    kind: 'product_family',
    aliases: ['aberturas', 'abertura', 'abertruas', 'ventana', 'ventanas'],
    familyLabel: 'aberturas',
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
  {
    key: 'product_topic:cortinas-venecianas',
    label: 'cortinas venecianas',
    kind: 'product_topic',
    aliases: ['cortinas venecianas', 'venecianas', 'veneciana'],
    parentKeys: ['product_family:cortina'],
    parentLabels: ['cortinas'],
    familyLabel: 'cortinas',
  },
  {
    key: 'product_topic:aberturas-aluminio',
    label: 'aberturas de aluminio',
    kind: 'product_topic',
    aliases: ['aberturas de aluminio', 'aberturas', 'aluminio'],
    parentKeys: ['product_family:abertura'],
    parentLabels: ['aberturas'],
    familyLabel: 'aberturas',
  },
  {
    key: 'product_variant:blackout',
    label: 'blackout',
    kind: 'product_variant',
    aliases: ['blackout'],
    parentKeys: ['product_topic:cortinas-roller', 'product_family:cortina'],
    parentLabels: ['cortinas roller', 'cortinas'],
    familyLabel: 'cortinas',
  },
  {
    key: 'product_variant:dvh',
    label: 'dvh',
    kind: 'product_variant',
    aliases: ['dvh', 'doble vidrio'],
    parentKeys: ['product_topic:aberturas-aluminio', 'product_family:abertura'],
    parentLabels: ['aberturas de aluminio', 'aberturas'],
    familyLabel: 'aberturas',
  },
  {
    key: 'product_variant:serie-20',
    label: '20',
    kind: 'product_variant',
    aliases: ['20', 'serie 20', 'linea 20'],
    normalizationValue: '20',
    parentKeys: ['product_topic:aberturas-aluminio', 'product_family:abertura'],
    parentLabels: ['ventanas corredizas', 'aberturas'],
    familyLabel: 'aberturas',
  },
]

test('resolveConversationThreads asks to split when the turn mixes two product threads', () => {
  const resolution = resolveConversationThreads({
    currentTurnText: 'me interesan roller y aberturas doble vidrio',
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.equal(resolution.requiresDisambiguation, true)
  assert.equal(resolution.activeThreadKey, null)
  assert.equal(resolution.multiTopicDetected, true)
  assert.match(resolution.promptText || '', /roller/i)
  assert.match(resolution.promptText || '', /aberturas/i)
})

test('resolveConversationThreads keeps the selected roller thread through variant and measurement follow-ups', () => {
  const firstTurn = resolveConversationThreads({
    currentTurnText: 'me interesan roller y aberturas doble vidrio',
    tenantTopicTaxonomy: TAXONOMY,
  })
  const secondTurn = resolveConversationThreads({
    currentTurnText: 'y las roller?',
    previousTaskState: {
      conversationThreads: firstTurn.threads,
      activeThreadKey: firstTurn.activeThreadKey,
    },
    tenantTopicTaxonomy: TAXONOMY,
  })
  const thirdTurn = resolveConversationThreads({
    currentTurnText: 'roller blackout',
    previousTaskState: {
      conversationThreads: secondTurn.threads,
      activeThreadKey: secondTurn.activeThreadKey,
    },
    tenantTopicTaxonomy: TAXONOMY,
  })
  const fourthTurn = resolveConversationThreads({
    currentTurnText: 'necesito de 120x120',
    previousTaskState: {
      conversationThreads: thirdTurn.threads,
      activeThreadKey: thirdTurn.activeThreadKey,
    },
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.match(secondTurn.activeThread?.resolvedLabel || '', /roller/i)
  assert.match(thirdTurn.activeThread?.resolvedLabel || '', /blackout/i)
  assert.equal(fourthTurn.measurementOnlyTurn, true)
  assert.match(fourthTurn.activeThread?.resolvedLabel || '', /roller/i)
  assert.match(fourthTurn.activeThread?.resolvedLabel || '', /blackout/i)
})

test('resolveConversationThreads can reconstruct the previous quote thread from canonical topic memory when explicit threads are missing', () => {
  const restoredMeasurementTurn = resolveConversationThreads({
    currentTurnText: 'de 2x2',
    previousTaskState: {
      canonicalTopic: {
        label: 'cortinas roller',
        type: 'product_topic',
        confidence: 0.7,
        source: 'conversation_memory',
      },
      quoteContext: {
        topicLabel: 'cortinas roller',
        familyLabel: 'cortinas',
      },
      conversationThreads: [],
      activeThreadKey: null,
    },
    tenantTopicTaxonomy: TAXONOMY,
  })

  const variantFollowUp = resolveConversationThreads({
    currentTurnText: '2 unidades blackout',
    previousTaskState: {
      canonicalTopic: {
        label: 'cortinas roller',
        type: 'product_topic',
        confidence: 0.66,
        source: 'conversation_memory',
      },
      quoteContext: {
        topicLabel: 'cortinas roller',
        familyLabel: 'cortinas',
        measurements: { widthMm: 2000, heightMm: 2000 },
      },
      conversationThreads: restoredMeasurementTurn.threads,
      activeThreadKey: restoredMeasurementTurn.activeThreadKey,
    },
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.match(restoredMeasurementTurn.activeThread?.resolvedLabel || '', /roller/i)
  assert.match(variantFollowUp.activeThread?.resolvedLabel || '', /roller blackout/i)
})

test('resolveConversationThreads switches to the explicit aberturas family when the turn names a new family plus a configuration term', () => {
  const previous = resolveConversationThreads({
    currentTurnText: 'cortinas roller',
    tenantTopicTaxonomy: TAXONOMY,
  })

  const switched = resolveConversationThreads({
    currentTurnText: 'y abertruas en aluminio tienen?',
    previousTaskState: {
      conversationThreads: previous.threads,
      activeThreadKey: previous.activeThreadKey,
    },
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.equal(switched.switchDetected, true)
  assert.match(switched.activeThread?.resolvedLabel || '', /aberturas/i)
})

test('resolveConversationThreads keeps venecianas de aluminio on the venecianas thread instead of opening aberturas de aluminio', () => {
  const resolution = resolveConversationThreads({
    currentTurnText:
      'Quería solicitar presupuesto de cortinas venecianas de aluminio sin instalación',
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.equal(resolution.requiresDisambiguation, false)
  assert.match(resolution.activeThread?.resolvedLabel || '', /venecianas/i)
  assert.doesNotMatch(resolution.activeThread?.resolvedLabel || '', /aberturas de aluminio/i)
})

test('resolveConversationThreads does not treat measurement tails as numeric series variants', () => {
  const resolution = resolveConversationThreads({
    currentTurnText:
      'Quería solicitar presupuesto de cortinas venecianas de aluminio sin instalación: - 6 de 0,9 x 1,2 - 8 de 0,9 x 1,4 - 2 de 0,9 x 2,20',
    tenantTopicTaxonomy: TAXONOMY,
  })

  assert.equal(resolution.requiresDisambiguation, false)
  assert.match(resolution.activeThread?.resolvedLabel || '', /venecianas/i)
  assert.doesNotMatch(resolution.activeThread?.resolvedLabel || '', /20/i)
})
