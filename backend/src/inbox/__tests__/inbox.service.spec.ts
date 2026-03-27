import { describe, expect, it, vi } from 'vitest'
import { InboxChannelType, InboxMessageDirection } from '@prisma/client'
import { InboxService } from '../inbox.service'

const createPrisma = () => ({
  inboxAccount: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  inboxMessage: {
    findUnique: vi.fn(),
  },
})

const createConfig = () => ({
  get: vi.fn(),
})

describe('InboxService', () => {
  it('lists only operational email accounts while preserving non-email channels', async () => {
    const prisma = createPrisma()
    const config = createConfig()
    const registry = {} as never
    const emailAdapter = {}
    const events = {
      streamEvents: vi.fn(),
    } as never

    config.get.mockImplementation((key: string) => {
      if (key === 'INBOX_EMAIL_DEFAULT_FROM') {
        return 'desarrollo@software-strategy.com'
      }
      return undefined
    })

    prisma.inboxAccount.findMany.mockResolvedValue([
      {
        id: 'acc_email_valid',
        channel: InboxChannelType.EMAIL,
        address: 'desarrollo@software-strategy.com',
        active: true,
        metadata: {
          defaults: { fromAddress: 'desarrollo@software-strategy.com' },
          imap: { host: 'mail.software-strategy.com' },
          smtp: { host: 'mail.software-strategy.com' },
          validation: {
            smtpTlsVerifiedAt: '2026-03-27T20:00:00.000Z',
            imapTlsVerifiedAt: '2026-03-27T20:00:00.000Z',
            smtpVerifyVerifiedAt: '2026-03-27T20:00:00.000Z',
            verifiedAt: '2026-03-27T20:00:00.000Z',
          },
        },
      },
      {
        id: 'acc_email_invalid',
        channel: InboxChannelType.EMAIL,
        address: 'ventas@urucortinas.com',
        active: true,
        metadata: {
          defaults: { fromAddress: 'ventas@urucortinas.com' },
          imap: { host: 'mail.fake.test' },
          smtp: { host: 'mail.fake.test' },
        },
      },
      {
        id: 'acc_whatsapp',
        channel: InboxChannelType.WHATSAPP,
        address: 'urucortinas:whatsapp',
        active: true,
        metadata: { source: 'conversation-hub' },
      },
    ])

    const service = new InboxService(
      prisma as never,
      config as never,
      registry,
      emailAdapter as never,
      events,
    )

    const result = await service.listAccounts()

    expect(result.map((account) => account.id)).toEqual([
      'acc_email_valid',
      'acc_whatsapp',
    ])
  })

  it('reads persisted message detail before falling back to the provider adapter', async () => {
    const prisma = createPrisma()
    const config = createConfig()
    const registry = {} as never
    const emailAdapter = {
      getMessage: vi.fn(),
    }
    const events = {
      streamEvents: vi.fn(),
    } as never

    prisma.inboxAccount.findUnique.mockResolvedValue({
      id: 'acc_1',
      channel: InboxChannelType.EMAIL,
    })
    prisma.inboxMessage.findUnique.mockResolvedValue({
      id: 'msg_1',
      accountId: 'acc_1',
      channel: InboxChannelType.EMAIL,
      provider: 'gmail',
      messageUid: 'uid_1',
      remoteId: 'remote_1',
      threadRemoteId: 'thread_1',
      subject: 'Consulta',
      snippet: 'Necesito info',
      previewText: 'Necesito info',
      fromAddress: 'cliente@example.com',
      fromName: 'Cliente',
      toAddresses: ['ventas@example.com'],
      ccAddresses: [],
      bccAddresses: [],
      replyToAddresses: [],
      direction: InboxMessageDirection.INBOUND,
      folder: 'INBOX',
      queueId: null,
      queue: null,
      isRead: false,
      isStarred: false,
      isSpam: false,
      hasAttachments: true,
      sentAt: null,
      receivedAt: new Date('2026-03-27T15:00:00.000Z'),
      bodyHash: 'hash_1',
      metadata: {
        canonicalThreadKey: 'thread:thread_1',
        bodyHtml: '<p>Necesito info</p>',
        bodyText: 'Necesito info',
        headers: {
          'message-id': '<msg-1@example.com>',
        },
      },
      attachments: [
        {
          id: 'att_1',
          messageId: 'msg_1',
          remoteId: 'remote_att_1',
          fileName: 'consulta.pdf',
          contentType: 'application/pdf',
          size: 1024,
          metadata: null,
          createdAt: new Date('2026-03-27T15:00:00.000Z'),
        },
      ],
    })

    const service = new InboxService(
      prisma as never,
      config as never,
      registry,
      emailAdapter as never,
      events,
    )

    const result = await service.getMessage('acc_1', {
      remoteId: 'remote_1',
      threadRemoteId: 'thread_1',
    })

    expect(emailAdapter.getMessage).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      id: 'msg_1',
      remoteId: 'remote_1',
      threadRemoteId: 'thread_1',
      subject: 'Consulta',
      authorLabel: 'Cliente',
      bodyText: 'Necesito info',
      bodyHtml: '<p>Necesito info</p>',
      attachments: [
        expect.objectContaining({
          id: 'att_1',
          fileName: 'consulta.pdf',
          contentType: 'application/pdf',
        }),
      ],
    })
    expect(result.headers).toMatchObject({
      'message-id': '<msg-1@example.com>',
    })
  })
})
