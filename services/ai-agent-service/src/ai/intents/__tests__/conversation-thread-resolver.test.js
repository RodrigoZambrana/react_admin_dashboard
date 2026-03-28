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
    aliases: ['aberturas', 'abertura', 'ventana', 'ventanas'],
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
