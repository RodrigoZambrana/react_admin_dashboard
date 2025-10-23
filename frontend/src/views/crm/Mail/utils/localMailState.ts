const STORAGE_KEY = 'crmMail.localState.v1'

type Primitive = string | number | boolean | null | undefined

export type LocalMailState = {
    isRead?: boolean
    starred?: boolean
    label?: string | null
    tags?: string[]
    flagged?: boolean
    metadataPatch?: Record<string, Primitive>
    updatedAt?: string
}

type MailIdentity = {
    id?: string | number | null
    remoteId?: string | number | null
    messageUid?: string | null
}

const isBrowser = () =>
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

let cache: Record<string, LocalMailState> | null = null

const sanitizePatch = (patch: LocalMailState): LocalMailState => {
    const cleaned: LocalMailState = {}
    Object.entries(patch).forEach(([key, value]) => {
        if (value !== undefined) {
            cleaned[key as keyof LocalMailState] = value as never
        }
    })
    return cleaned
}

const hasMeaningfulData = (state: LocalMailState) =>
    Object.entries(state).some(
        ([key, value]) => key !== 'updatedAt' && value !== undefined,
    )

const readCache = () => {
    if (cache) {
        return cache
    }
    if (!isBrowser()) {
        cache = {}
        return cache
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            cache = {}
            return cache
        }
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object') {
            cache = parsed as Record<string, LocalMailState>
            return cache
        }
    } catch (error) {
        console.warn('[MailLocalState] unable to read cache', error)
    }
    cache = {}
    return cache
}

const writeCache = () => {
    if (!isBrowser() || !cache) {
        return
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch (error) {
        console.warn('[MailLocalState] unable to persist cache', error)
    }
}

export const getMailPersistenceKey = (identity: MailIdentity) => {
    if (identity.messageUid) {
        return `uid:${identity.messageUid}`
    }
    if (identity.remoteId !== undefined && identity.remoteId !== null) {
        return `remote:${String(identity.remoteId)}`
    }
    if (identity.id !== undefined && identity.id !== null) {
        return `id:${String(identity.id)}`
    }
    return ''
}

export const getMailLocalState = (identity: MailIdentity) => {
    const key = getMailPersistenceKey(identity)
    if (!key) {
        return null
    }
    const store = readCache()
    return store[key] ?? null
}

export const upsertMailLocalState = (
    identity: MailIdentity,
    patch: LocalMailState,
) => {
    const key = getMailPersistenceKey(identity)
    if (!key) {
        return
    }
    const store = readCache()
    const sanitized = sanitizePatch(patch)
    const merged: LocalMailState = {
        ...(store[key] ?? {}),
        ...sanitized,
    }
    if (!hasMeaningfulData(merged)) {
        delete store[key]
    } else {
        merged.updatedAt = new Date().toISOString()
        store[key] = merged
    }
    cache = store
    writeCache()
}

export const removeMailLocalState = (identity: MailIdentity) => {
    const key = getMailPersistenceKey(identity)
    if (!key) {
        return
    }
    const store = readCache()
    if (store[key]) {
        delete store[key]
        cache = store
        writeCache()
    }
}

type MailLike = MailIdentity & {
    isRead?: boolean
    starred?: boolean
    label?: string | null
    flags?: Record<string, unknown>
    flagged?: boolean
    metadata?: Record<string, unknown> | null
}

export const applyMailLocalState = <T extends MailLike>(mail: T): T => {
    const local = getMailLocalState(mail)
    if (!local) {
        return mail
    }
    const next = { ...mail }
    if (Object.prototype.hasOwnProperty.call(local, 'isRead')) {
        next.isRead = local.isRead
    }
    if (Object.prototype.hasOwnProperty.call(local, 'starred')) {
        next.starred = local.starred
    }
    if (Object.prototype.hasOwnProperty.call(local, 'flagged')) {
        next.flagged = local.flagged
    }
    if (Object.prototype.hasOwnProperty.call(local, 'label')) {
        next.label = local.label ?? ''
    }
    if (local.tags) {
        const metadata = { ...(next.metadata ?? {}) }
        metadata.tags = [...local.tags]
        next.metadata = metadata
    }
    if (local.metadataPatch) {
        const metadata = { ...(next.metadata ?? {}) }
        Object.assign(metadata, local.metadataPatch)
        next.metadata = metadata
    }
    return next
}
