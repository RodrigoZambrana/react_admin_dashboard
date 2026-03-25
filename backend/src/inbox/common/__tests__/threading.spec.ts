import { describe, expect, it } from 'vitest'
import {
  buildCanonicalThreadKey,
  normalizeThreadSubject,
  resolveMessageActivityAt,
} from '../threading'

describe('inbox threading helpers', () => {
  it('prefers provider thread ids over other heuristics', () => {
    expect(
      buildCanonicalThreadKey({
        threadRemoteId: 'THREAD-123',
        messageId: '<abc@example.com>',
        subject: 'Re: Pedido',
      }),
    ).toEqual({
      key: 'thread:thread-123',
      reason: 'provider-thread',
    })
  })

  it('normalizes localized subject prefixes', () => {
    expect(normalizeThreadSubject('Re: Fwd: Pedido urgente')).toBe('pedido urgente')
  })

  it('falls back to message chain headers when thread id is absent', () => {
    expect(
      buildCanonicalThreadKey({
        references: '<root@example.com> <child@example.com>',
        subject: 'Re: Pedido',
      }),
    ).toEqual({
      key: 'message-chain:root@example.com',
      reason: 'references',
    })
  })

  it('uses subject plus participants before subject-only fallback', () => {
    expect(
      buildCanonicalThreadKey({
        subject: 'Re: Consulta de cortinas',
        fromAddress: 'cliente@example.com',
        toAddresses: ['ventas@example.com'],
      }),
    ).toEqual({
      key: 'subject-participants:consulta de cortinas:cliente@example.com|ventas@example.com',
      reason: 'subject-participants',
    })
  })

  it('resolves message activity using the newest transport timestamp', () => {
    const sentAt = new Date('2026-03-25T12:00:00.000Z')
    const receivedAt = new Date('2026-03-25T12:01:00.000Z')

    expect(resolveMessageActivityAt({ sentAt, receivedAt })?.toISOString()).toBe(
      '2026-03-25T12:01:00.000Z',
    )
  })
})
