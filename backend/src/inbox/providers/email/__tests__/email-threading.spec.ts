import { describe, expect, it } from 'vitest'
import {
  buildThreadKey,
  normalizeThreadingHeaders,
} from '../email-threading'

describe('normalizeThreadingHeaders', () => {
  it('normalizes message identifiers and removes blanks', () => {
    const normalized = normalizeThreadingHeaders({
      messageId: '<Foo@Example.COM>',
      inReplyTo: ' <bar@example.com> ',
      references: ['<one@acme.com>', ' ', '<Two@ACME.com>'],
    })

    expect(normalized).toEqual({
      messageId: 'foo@example.com',
      inReplyTo: 'bar@example.com',
      references: ['one@acme.com', 'two@acme.com'],
      threadRemoteId: null,
    })
  })
})

describe('buildThreadKey', () => {
  it('prefers thread remote id', () => {
    const key = buildThreadKey(
      normalizeThreadingHeaders({
        threadRemoteId: '123',
        inReplyTo: '<parent@acme.com>',
      }),
    )
    expect(key).toBe('123')
  })

  it('falls back to in-reply-to and references', () => {
    const key = buildThreadKey(
      normalizeThreadingHeaders({
        inReplyTo: '<parent@acme.com>',
        references: ['<root@acme.com>'],
      }),
    )
    expect(key).toBe('parent@acme.com')
  })

  it('uses last reference when reply-to missing', () => {
    const key = buildThreadKey(
      normalizeThreadingHeaders({
        references: ['<root@acme.com>', '<middle@acme.com>'],
      }),
    )
    expect(key).toBe('middle@acme.com')
  })

  it('returns message id as final fallback', () => {
    const key = buildThreadKey(normalizeThreadingHeaders({ messageId: '<root@acme.com>' }))
    expect(key).toBe('root@acme.com')
  })

  it('returns null when no identifiers exist', () => {
    const key = buildThreadKey(normalizeThreadingHeaders({}))
    expect(key).toBeNull()
  })
})
