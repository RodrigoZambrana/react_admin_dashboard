import { describe, expect, it } from 'vitest'
import { isInboxCategorySelection } from '../category'

describe('isInboxCategorySelection', () => {
    it('treats value inbox as inbox category', () => {
        expect(
            isInboxCategorySelection({
                value: 'INBOX',
            }),
        ).toBe(true)
    })

    it('falls back to legacy category field when value is absent', () => {
        expect(
            isInboxCategorySelection({
                category: 'inbox',
            }),
        ).toBe(true)
    })

    it('does not treat other folders as inbox', () => {
        expect(
            isInboxCategorySelection({
                value: 'Spam',
            }),
        ).toBe(false)
    })
})
