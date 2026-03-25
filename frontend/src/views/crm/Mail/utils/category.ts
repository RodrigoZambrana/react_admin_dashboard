import { normalizeMailboxKey } from './labels'

export type SelectedMailCategory = {
    category?: string
    value?: string
}

export const isInboxCategorySelection = (
    selectedCategory: SelectedMailCategory | null | undefined,
) => {
    const rawValue =
        selectedCategory?.value ??
        selectedCategory?.category ??
        ''

    return normalizeMailboxKey(String(rawValue)) === 'inbox'
}

export const hasRealMailboxSelection = (options: {
    accountId?: string | null
    mailboxId?: string | null
}) =>
    Boolean(
        options.accountId &&
            options.accountId.trim().length > 0 &&
            options.mailboxId &&
            options.mailboxId.trim().length > 0,
    )
