import { describe, expect, it } from 'vitest'
import { resolveTextDirection } from '../textDirection'

describe('resolveTextDirection', () => {
    it('returns ltr for empty or undefined values', () => {
        expect(resolveTextDirection()).toBe('ltr')
        expect(resolveTextDirection('')).toBe('ltr')
    })

    it('detects latin text as ltr', () => {
        expect(resolveTextDirection('hola')).toBe('ltr')
        expect(resolveTextDirection('123 hola')).toBe('ltr')
    })

    it('detects rtl scripts', () => {
        expect(resolveTextDirection('שלום')).toBe('rtl')
        expect(resolveTextDirection('مرحبا')).toBe('rtl')
    })
})

