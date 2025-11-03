const memoryCache = new Map<string, { value: unknown; expiresAt: number }>()

const isBrowser = typeof window !== "undefined"

const DEFAULT_TTL_MS = 5 * 60 * 1000

const resolveExpiry = (ttlMs?: number) => Date.now() + (ttlMs ?? DEFAULT_TTL_MS)

export function setCachedValue<T>(key: string, value: T, ttlMs?: number) {
  const payload = { value, expiresAt: resolveExpiry(ttlMs) }
  memoryCache.set(key, payload)
  if (!isBrowser) {
    return
  }
  try {
    const serialised = JSON.stringify(payload)
    window.localStorage.setItem(key, serialised)
  } catch (error) {
    console.warn("[cache] Unable to persist key", key, error)
  }
}

export function getCachedValue<T>(key: string): T | null {
  const now = Date.now()
  const memoryEntry = memoryCache.get(key)
  if (memoryEntry && memoryEntry.expiresAt > now) {
    return memoryEntry.value as T
  }

  if (!isBrowser) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as { value: T; expiresAt: number }
    if (parsed.expiresAt <= now) {
      window.localStorage.removeItem(key)
      return null
    }
    memoryCache.set(key, parsed)
    return parsed.value
  } catch (error) {
    console.warn("[cache] Unable to read key", key, error)
    return null
  }
}

export function clearCachedValue(key: string) {
  memoryCache.delete(key)
  if (!isBrowser) {
    return
  }
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.warn("[cache] Unable to clear key", key, error)
  }
}
