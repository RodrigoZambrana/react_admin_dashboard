import { describe, expect, it } from 'vitest'

import { sanitizeInput } from '../sanitize'

describe('sanitizeInput', () => {
  it('allows tokens that contain double hyphen mid-string', () => {
    const value = 'oauth-code-with--double-hyphen'
    expect(sanitizeInput(value)).toBe(value)
  })

  it('still blocks SQL-style comment attempts', () => {
    expect(() => sanitizeInput(' -- comment')).toThrowError(/invalidCharacters/)
    expect(() => sanitizeInput("email';--")).toThrowError(/invalidCharacters/)
  })
})
