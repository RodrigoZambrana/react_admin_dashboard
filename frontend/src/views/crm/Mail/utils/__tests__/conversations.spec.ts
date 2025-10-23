import { describe, expect, it } from 'vitest'

import {
    mergeMailMetadata,
    mergeMailMessages,
    normalizeMessageIdentifier,
} from '../conversations'
import type { Mail } from '../../store'

type MailMessage = Mail['message'][number]

const createMessage = (overrides: Partial<MailMessage> = {}): MailMessage => ({
    id: overrides.id ?? `message-${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? 'Sender',
    mail: overrides.mail ?? [],
    from: overrides.from ?? 'sender@example.com',
    avatar: overrides.avatar ?? '',
    date: overrides.date ?? '2025-01-01T00:00:00Z',
    content: overrides.content ?? 'content',
    attachment: overrides.attachment ?? [],
    to: overrides.to,
    cc: overrides.cc,
    bcc: overrides.bcc,
    sentAt: overrides.sentAt,
    receivedAt: overrides.receivedAt,
    direction: overrides.direction ?? 'inbound',
    headers: overrides.headers,
    messageUid: overrides.messageUid,
})

describe('mergeMailMessages', () => {
    it('merges unique messages and keeps chronological order', () => {
        const existing = [
            createMessage({
                id: '1',
                receivedAt: '2024-01-01T10:00:00Z',
                content: 'original',
            }),
        ]
        const incoming = [
            createMessage({
                id: '2',
                receivedAt: '2024-01-02T09:00:00Z',
                content: 'reply',
            }),
            createMessage({
                id: '1',
                receivedAt: '2024-01-01T10:00:00Z',
                content: 'original updated',
            }),
        ]

        const merged = mergeMailMessages(existing, incoming)

        expect(merged).toHaveLength(2)
        expect(merged[0].id).toBe('1')
        expect(merged[0].content).toBe('original updated')
        expect(merged[1].id).toBe('2')
    })

    it('returns an empty array when inputs are undefined', () => {
        expect(mergeMailMessages(undefined, undefined)).toEqual([])
    })
})

describe('mergeMailMetadata', () => {
    it('combines identifiers, references, headers, and attachments', () => {
        const existing = {
            messageId: normalizeMessageIdentifier('<original-id>'),
            references: ['<original-id>'],
            headers: { 'message-id': '<original-id>' },
            attachments: [{ id: 'a', fileName: 'initial.txt', size: 1 }],
        } satisfies Record<string, unknown>

        const incoming = {
            messageId: normalizeMessageIdentifier('<reply-id>'),
            inReplyTo: '<original-id>',
            references: ['<original-id>', '<reply-id>'],
            threadKey: '<original-id>',
            headers: { subject: 'Hello' },
            attachments: [
                { id: 'b', fileName: 'reply.txt', size: 2 },
                { id: 'a', fileName: 'initial.txt', size: 4 },
            ],
        } satisfies Record<string, unknown>

        const merged = mergeMailMetadata(existing, incoming)

        expect(merged).not.toBeNull()
        expect(merged?.messageId).toBe('reply-id')
        expect(merged?.inReplyTo).toBe('original-id')
        expect(merged?.threadKey).toBe('original-id')
        expect(merged?.references).toEqual(['original-id', 'reply-id'])
        expect(merged?.headers).toMatchObject({
            'message-id': '<original-id>',
            subject: 'Hello',
        })
        expect(Array.isArray(merged?.attachments)).toBe(true)
        expect((merged?.attachments as unknown[])?.length).toBe(2)
    })

    it('returns null when both metadata inputs are empty', () => {
        expect(mergeMailMetadata(null, null)).toBeNull()
        expect(mergeMailMetadata(undefined, undefined)).toBeNull()
    })
})
