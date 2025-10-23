import type { TFunction } from 'i18next'
import { groupList, labelList } from '../constants'
import type { Group, Label } from '../constants'

export const normalizeMailboxKey = (value: string) =>
    value ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') : ''

export const MAILBOX_LABEL_TRANSLATION_MAP: Record<string, string> = {
    inbox: 'crm.mail.categories.inbox',
    sent: 'crm.mail.categories.sentItem',
    sentitem: 'crm.mail.categories.sentItem',
    sentitems: 'crm.mail.categories.sentItem',
    draft: 'crm.mail.categories.draft',
    drafts: 'crm.mail.categories.draft',
    starred: 'crm.mail.categories.starred',
    deleted: 'crm.mail.categories.deleted',
    archive: 'crm.mail.dynamicMailboxes.archive',
    spam: 'crm.mail.dynamicMailboxes.spam',
    trash: 'crm.mail.dynamicMailboxes.trash',
    junk: 'crm.mail.dynamicMailboxes.junk',
}

export const translateMailboxLabel = (
    t: TFunction,
    value: string,
    fallback?: string,
) => {
    const normalized = normalizeMailboxKey(value)
    const defaultLabel = fallback ?? value
    if (!normalized) {
        return defaultLabel
    }
    const translationKey = MAILBOX_LABEL_TRANSLATION_MAP[normalized]
    if (translationKey) {
        return t(translationKey, { defaultValue: defaultLabel })
    }
    return t(`crm.mail.dynamicMailboxes.${normalized}`, {
        defaultValue: defaultLabel,
    })
}

export const resolveGroupLabel = (t: TFunction, group: Group) =>
    translateMailboxLabel(t, group.value, group.label)

export const resolveLabelBadge = (t: TFunction, label: Label) =>
    t(`crm.mail.labelsList.${label.value}`, {
        defaultValue: label.label,
    })

export const findStaticCategory = (value: string) => {
    const groupMatch = groupList.find((group) => group.value === value)
    if (groupMatch) {
        return groupMatch
    }
    const labelMatch = labelList.find((label) => label.value === value)
    if (labelMatch) {
        return labelMatch
    }
    return null
}
