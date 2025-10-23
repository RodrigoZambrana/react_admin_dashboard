import { describe, expect, it } from 'vitest'
import {
  deriveMessageUid,
  hashMessageBody,
  normalizeFolder,
  normalizeMessageId,
} from '../message-identity'

describe('normalizeFolder', () => {
  it('normalizes undefined folder to inbox', () => {
    expect(normalizeFolder(undefined)).toBe('inbox')
  })

  it('normalizes custom folder', () => {
    expect(normalizeFolder('Support')).toBe('support')
  })
})

describe('deriveMessageUid', () => {
  it('prefers message id when available', () => {
    const uid = deriveMessageUid({
      provider: 'gmail',
      folder: 'INBOX',
      messageId: '<ABC@acme.com>',
    })
    expect(uid).toBe('gmail:inbox:mid:abc@acme.com')
  })

  it('falls back to remote id before gmail id', () => {
    const remoteFirst = deriveMessageUid({
      provider: 'gmail',
      folder: 'Sales',
      gmailId: '178234',
      remoteId: '42',
    })
    expect(remoteFirst).toBe('gmail:sales:remote:42')

    const uid = deriveMessageUid({
      provider: 'gmail',
      folder: 'Sales',
      gmailId: '178234',
    })
    expect(uid).toBe('gmail:sales:gmail:178234')
  })

  it('uses remote id as last resort', () => {
    const uid = deriveMessageUid({
      provider: 'imap',
      folder: 'Support',
      remoteId: '123',
    })
    expect(uid).toBe('imap:support:remote:123')
  })

  it('hashes body when nothing else is available', () => {
    const uid = deriveMessageUid({
      provider: 'imap',
      folder: 'Inbox',
      bodyHtml: '<p>Hello</p>',
      bodyText: 'Hello',
    })
    expect(uid.startsWith('imap:inbox:hash:')).toBe(true)
  })
})

describe('normalizeMessageId', () => {
  it('normalizes angle brackets and casing', () => {
    expect(normalizeMessageId('<Foo@Example.com>')).toBe('foo@example.com')
  })

  it('returns null for empty values', () => {
    expect(normalizeMessageId('')).toBeNull()
    expect(normalizeMessageId(undefined)).toBeNull()
  })
})

describe('hashMessageBody', () => {
  it('returns null when both bodies empty', () => {
    expect(hashMessageBody({})).toBeNull()
  })

  it('hashes html and text combined', () => {
    const hash = hashMessageBody({ bodyHtml: '<p>hello</p>', bodyText: 'hello' })
    expect(hash).toMatch(/^[0-9a-f]{40}$/)
  })
})
