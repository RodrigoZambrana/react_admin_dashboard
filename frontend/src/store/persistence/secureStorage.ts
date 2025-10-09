import createWebStorage from 'redux-persist/lib/storage/createWebStorage'
import { sha256 } from 'js-sha256'
import { STATE_SIGNATURE_KEY } from '@/constants/security.constant'

type PersistStorage = ReturnType<typeof createWebStorage>

type Envelope = {
    version: number
    payload: string
    signature: string
}

const STORAGE_VERSION = 1

const baseStorage: PersistStorage =
    typeof window !== 'undefined'
        ? createWebStorage('local')
        : ({
              getItem: () => Promise.resolve(null),
              setItem: (_key: string, value: string) => Promise.resolve(value),
              removeItem: () => Promise.resolve(),
          } as PersistStorage)

const signPayload = (payload: string) =>
    sha256.hmac(STATE_SIGNATURE_KEY, payload)

const wrap = (payload: string): string =>
    JSON.stringify({
        version: STORAGE_VERSION,
        payload,
        signature: signPayload(payload),
    } satisfies Envelope)

const unwrap = (raw: string | null): string | null => {
    if (!raw) return raw
    try {
        const parsed = JSON.parse(raw) as Partial<Envelope>
        if (parsed.version !== STORAGE_VERSION) {
            return null
        }
        if (!parsed.payload || !parsed.signature) {
            return null
        }
        const expected = signPayload(parsed.payload)
        if (expected !== parsed.signature) {
            return null
        }
        return parsed.payload
    } catch {
        return null
    }
}

const secureStorage = {
    async getItem(key: string) {
        const raw = await baseStorage.getItem(key)
        const unwrapped = unwrap(raw)
        if (raw && !unwrapped) {
            await baseStorage.removeItem(key)
        }
        return unwrapped
    },
    async setItem(key: string, value: string) {
        return baseStorage.setItem(key, wrap(value))
    },
    async removeItem(key: string) {
        return baseStorage.removeItem(key)
    },
}

export default secureStorage

export const purgeIfTampered = async (key: string) => {
    const raw = await baseStorage.getItem(key)
    if (!raw) return
    if (!unwrap(raw)) {
        await baseStorage.removeItem(key)
    }
}

