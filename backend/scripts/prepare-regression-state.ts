import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, InboxChannelType } from '@prisma/client'

const prisma = new PrismaClient()

const SYNTHETIC_EMAIL_SUBJECT_FRAGMENTS = [
  'Reply email',
  'Consulta email',
  'Probe email webhook',
] as const

function loadEnvFromBackendRoot() {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) {
      continue
    }

    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

const buildContainsFilters = (field: 'subject') =>
  SYNTHETIC_EMAIL_SUBJECT_FRAGMENTS.map((fragment) => ({
    [field]: {
      contains: fragment,
      mode: 'insensitive' as const,
    },
  }))

async function main() {
  loadEnvFromBackendRoot()
  const dryRun = process.argv.includes('--dry-run')
  const configuredAddress = (
    process.env.INBOX_EMAIL_DEFAULT_FROM || process.env.INBOX_EMAIL_USER || ''
  )
    .trim()
    .toLowerCase()

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }

  if (!configuredAddress) {
    throw new Error(
      'INBOX_EMAIL_DEFAULT_FROM or INBOX_EMAIL_USER is required to preserve the configured mailbox.',
    )
  }

  const emailAccounts = await prisma.inboxAccount.findMany({
    where: { channel: InboxChannelType.EMAIL },
    select: {
      id: true,
      address: true,
      active: true,
    },
  })

  const invalidEmailAccountIds = emailAccounts
    .filter((account) => (account.address || '').trim().toLowerCase() !== configuredAddress)
    .map((account) => account.id)

  const conversationWhereOr = [
    ...buildContainsFilters('subject'),
    ...(invalidEmailAccountIds.length > 0
      ? [{ inboxAccountId: { in: invalidEmailAccountIds } }]
      : []),
  ]

  const conversations = conversationWhereOr.length
    ? await prisma.conversation.findMany({
        where: { OR: conversationWhereOr },
        select: { id: true },
      })
    : []

  const conversationIds = conversations.map((conversation) => conversation.id)

  const messages = conversationIds.length
    ? await prisma.conversationMessage.findMany({
        where: { conversationId: { in: conversationIds } },
        select: { id: true, inboxMessageId: true },
      })
    : []

  const messageIds = messages.map((message) => message.id)
  const referencedInboxMessageIds = messages
    .map((message) => message.inboxMessageId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  const rawEvents = conversationIds.length
    ? await prisma.knowledgeRawEvent.findMany({
        where: {
          OR: [
            { conversationId: { in: conversationIds } },
            ...(messageIds.length > 0 ? [{ messageId: { in: messageIds } }] : []),
          ],
        },
        select: { id: true },
      })
    : []

  const rawEventIds = rawEvents.map((entry) => entry.id)

  const candidates = conversationIds.length
    ? await prisma.knowledgeCandidate.findMany({
        where: {
          OR: [
            { conversationId: { in: conversationIds } },
            ...(messageIds.length > 0 ? [{ messageId: { in: messageIds } }] : []),
            ...(rawEventIds.length > 0 ? [{ observationId: { in: rawEventIds } }] : []),
          ],
        },
        select: { id: true },
      })
    : []

  const candidateIds = candidates.map((entry) => entry.id)

  const feedbacks = conversationIds.length
    ? await prisma.knowledgeSuggestionFeedback.findMany({
        where: {
          OR: [
            { conversationId: { in: conversationIds } },
            ...(candidateIds.length > 0 ? [{ candidateId: { in: candidateIds } }] : []),
          ],
        },
        select: { id: true },
      })
    : []

  const feedbackIds = feedbacks.map((entry) => entry.id)

  const syntheticInboxMessages = await prisma.inboxMessage.findMany({
    where: {
      OR: [
        ...buildContainsFilters('subject'),
        ...(invalidEmailAccountIds.length > 0
          ? [{ accountId: { in: invalidEmailAccountIds } }]
          : []),
        ...(referencedInboxMessageIds.length > 0
          ? [{ id: { in: referencedInboxMessageIds } }]
          : []),
      ],
    },
    select: { id: true },
  })

  const syntheticInboxMessageIds = syntheticInboxMessages.map((entry) => entry.id)

  const summary = {
    configuredAddress,
    invalidEmailAccountIds,
    conversationIds,
    messageIds,
    rawEventIds,
    candidateIds,
    feedbackIds,
    syntheticInboxMessageIds,
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        configuredAddress,
        conversations: conversationIds.length,
        messages: messageIds.length,
        rawEvents: rawEventIds.length,
        candidates: candidateIds.length,
        feedbacks: feedbackIds.length,
        inboxMessages: syntheticInboxMessageIds.length,
        invalidEmailAccounts: invalidEmailAccountIds.length,
      },
      null,
      2,
    ),
  )

  if (dryRun) {
    return
  }

  await prisma.$transaction(async (tx) => {
    if (feedbackIds.length > 0) {
      await tx.knowledgeNegativeExample.deleteMany({
        where: {
          OR: [
            { feedbackId: { in: feedbackIds } },
            ...(conversationIds.length > 0 ? [{ conversationId: { in: conversationIds } }] : []),
            ...(candidateIds.length > 0 ? [{ candidateId: { in: candidateIds } }] : []),
          ],
        },
      })
    }

    if (feedbackIds.length > 0 || conversationIds.length > 0 || candidateIds.length > 0) {
      await tx.knowledgeSuggestionFeedback.deleteMany({
        where: {
          OR: [
            ...(feedbackIds.length > 0 ? [{ id: { in: feedbackIds } }] : []),
            ...(conversationIds.length > 0 ? [{ conversationId: { in: conversationIds } }] : []),
            ...(candidateIds.length > 0 ? [{ candidateId: { in: candidateIds } }] : []),
          ],
        },
      })
    }

    if (candidateIds.length > 0) {
      await tx.knowledgeCandidate.deleteMany({
        where: { id: { in: candidateIds } },
      })
    }

    if (rawEventIds.length > 0) {
      await tx.knowledgeRawEvent.deleteMany({
        where: { id: { in: rawEventIds } },
      })
    }

    if (conversationIds.length > 0) {
      await tx.knowledgeConversationBundle.deleteMany({
        where: { conversationId: { in: conversationIds } },
      })
    }

    if (conversationIds.length > 0) {
      await tx.conversation.deleteMany({
        where: { id: { in: conversationIds } },
      })
    }

    if (syntheticInboxMessageIds.length > 0) {
      await tx.inboxMessage.deleteMany({
        where: { id: { in: syntheticInboxMessageIds } },
      })
    }

    if (invalidEmailAccountIds.length > 0) {
      await tx.inboxAccount.updateMany({
        where: { id: { in: invalidEmailAccountIds } },
        data: {
          active: false,
        },
      })
    }
  })

  const deletableInvalidAccounts = await prisma.inboxAccount.findMany({
    where: { id: { in: invalidEmailAccountIds } },
    select: {
      id: true,
      messages: { select: { id: true }, take: 1 },
      conversations: { select: { id: true }, take: 1 },
      syncStates: { select: { id: true }, take: 1 },
    },
  })

  const accountIdsToDelete = deletableInvalidAccounts
    .filter(
      (account) =>
        account.messages.length === 0 &&
        account.conversations.length === 0 &&
        account.syncStates.length === 0,
    )
    .map((account) => account.id)

  if (accountIdsToDelete.length > 0) {
    await prisma.inboxAccount.deleteMany({
      where: { id: { in: accountIdsToDelete } },
    })
  }

  console.log(
    JSON.stringify(
      {
        cleaned: true,
        removedConversations: conversationIds.length,
        removedInboxMessages: syntheticInboxMessageIds.length,
        deactivatedInvalidEmailAccounts: invalidEmailAccountIds.length,
        deletedInvalidEmailAccounts: accountIdsToDelete.length,
      },
      null,
      2,
    ),
  )

  console.log(
    JSON.stringify(
      {
        preserved: {
          configuredAddress,
        },
        targets: summary,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
