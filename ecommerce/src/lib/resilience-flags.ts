const deriveEnvDefault = (): boolean => {
  const raw =
    process.env.NEXT_PUBLIC_ENABLE_SNAPSHOT_FALLBACKS ??
    process.env.ENABLE_STOREFRONT_FALLBACKS
  if (raw === undefined) {
    return false
  }
  return !(raw === 'false' || raw === '0')
}

const envSnapshotFallbackDefault = deriveEnvDefault()

let serverSnapshotFallbackEnabled = envSnapshotFallbackDefault

declare global {
  interface Window {
    __STORE_RESILIENCE__?: {
      snapshotFallbackEnabled?: boolean
    }
  }
}

export const setSnapshotFallbackEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") {
    serverSnapshotFallbackEnabled = enabled
  } else {
    window.__STORE_RESILIENCE__ = {
      ...(window.__STORE_RESILIENCE__ ?? {}),
      snapshotFallbackEnabled: enabled,
    }
  }
}

export const isSnapshotFallbackEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return serverSnapshotFallbackEnabled
  }
  return window.__STORE_RESILIENCE__?.snapshotFallbackEnabled ?? envSnapshotFallbackDefault
}

export {}
