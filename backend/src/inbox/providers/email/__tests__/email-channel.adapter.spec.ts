import { describe, expect, it } from 'vitest'
import {
  decodeEmailListCursor,
  encodeEmailListCursor,
  resolveEmailListWindow,
} from '../email-channel.adapter'

describe('email inbox cursor pagination helpers', () => {
  it('encodes and decodes cursors safely', () => {
    const encoded = encodeEmailListCursor({ beforeSeq: 81 })

    expect(decodeEmailListCursor(encoded)).toEqual({ beforeSeq: 81 })
  })

  it('returns null for invalid cursors', () => {
    expect(decodeEmailListCursor('invalid-cursor')).toBeNull()
    expect(decodeEmailListCursor(null)).toBeNull()
  })

  it('builds the latest window when no cursor is provided', () => {
    expect(resolveEmailListWindow(100, 20, null)).toEqual({
      start: 81,
      end: 100,
      sequence: '81:100',
      nextCursor: encodeEmailListCursor({ beforeSeq: 81 }),
    })
  })

  it('builds the previous window when a cursor is provided', () => {
    const cursor = encodeEmailListCursor({ beforeSeq: 81 })

    expect(resolveEmailListWindow(100, 20, cursor)).toEqual({
      start: 61,
      end: 80,
      sequence: '61:80',
      nextCursor: encodeEmailListCursor({ beforeSeq: 61 }),
    })
  })

  it('returns null nextCursor when the oldest page is reached', () => {
    const cursor = encodeEmailListCursor({ beforeSeq: 11 })

    expect(resolveEmailListWindow(100, 20, cursor)).toEqual({
      start: 1,
      end: 10,
      sequence: '1:10',
      nextCursor: null,
    })
  })
})
