import { describe, expect, it } from 'vitest'

import { resolveDisplayIdentifier } from '../OrdersHistory'

describe('resolveDisplayIdentifier', () => {
    it('prioritizes uuid over all other identifiers', () => {
        expect(
            resolveDisplayIdentifier({
                id: 14,
                uuid: '7c0f6c3a-1111-2222-3333-444455556666',
                orderNumber: 'ORD-14',
                reference: 'REF-14',
            } as any),
        ).toBe('7c0f6c3a-1111-2222-3333-444455556666')
    })

    it('falls back to orderNumber and then reference', () => {
        expect(
            resolveDisplayIdentifier({
                id: 15,
                uuid: '',
                orderNumber: 'ORD-15',
                reference: 'REF-15',
            } as any),
        ).toBe('ORD-15')

        expect(
            resolveDisplayIdentifier({
                id: 16,
                uuid: '   ',
                orderNumber: '',
                reference: 'REF-16',
            } as any),
        ).toBe('REF-16')
    })

    it('falls back to numeric id when no public identifier exists', () => {
        expect(
            resolveDisplayIdentifier({
                id: 17,
                uuid: '',
                orderNumber: '',
                reference: '',
            } as any),
        ).toBe(17)
    })
})
