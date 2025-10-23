import type { Routes } from '@/@types/routes'
import type { AppConfig } from './app.config'
import type { ThemeConfig } from './theme.config'
import deepMerge from '@/utils/deepMerge'

export type ClientRouteGroup = 'public' | 'protected'

export interface ClientRouteOverride {
    disabledRouteKeys?: string[]
    additionalRoutes?: Routes
}

export interface ClientFrontendConfig {
    app?: Partial<AppConfig>
    theme?: Partial<ThemeConfig>
    routes?: Record<ClientRouteGroup, ClientRouteOverride | undefined>
    metadata?: Record<string, unknown>
}

export interface ClientVariantConfig {
    slug: string
    displayName: string
    description?: string
    featureFlags?: Record<string, boolean>
    frontend?: ClientFrontendConfig
    backend?: Record<string, unknown>
    shared?: Record<string, unknown>
    metadata?: Record<string, unknown>
}

type ClientModule = {
    default: ClientVariantConfig
}

const BASE_SLUG = 'core'
const FALLBACK_SLUG = BASE_SLUG

const clientModules = import.meta.glob<ClientModule>(
    '../clients/*/config.ts',
    { eager: true },
)

const resolveAvailableClientSlugs = (): string[] =>
    Array.from(
        new Set(
            Object.keys(clientModules).map((key) => {
                const normalised = key.replace(/\\/g, '/')
                return normalised.replace('../clients/', '').split('/')[0]
            }),
        ),
    )

const resolvedAvailableClientSlugs = resolveAvailableClientSlugs()

const sanitiseSlug = (slug: string): string =>
    slug.replace(/[^a-z0-9_-]/gi, '').toLowerCase()

const normaliseSlugForMatch = (slug: string): string =>
    slug.replace(/[^a-z0-9]/gi, '').toLowerCase()

const findAvailableSlug = (slug: string): string | undefined => {
    const sanitised = sanitiseSlug(slug)
    if (!sanitised) {
        return undefined
    }

    const directMatch = resolvedAvailableClientSlugs.find(
        (available) => sanitiseSlug(available) === sanitised,
    )
    if (directMatch) {
        return directMatch
    }

    const normalisedInput = normaliseSlugForMatch(sanitised)
    return resolvedAvailableClientSlugs.find(
        (available) => normaliseSlugForMatch(available) === normalisedInput,
    )
}

const matchFromCandidates = (
    candidates: (string | null | undefined)[],
): string | undefined => {
    for (const candidate of candidates) {
        if (!candidate) {
            continue
        }
        const match = findAvailableSlug(candidate.trim())
        if (match) {
            return match
        }
    }
    return undefined
}

const getSlugFromUrl = (): string | undefined => {
    if (typeof window === 'undefined') {
        return undefined
    }

    const { location } = window
    const searchParams = new URLSearchParams(location.search)

    const queryMatch = matchFromCandidates(
        ['client', 'slug', 'tenant'].map((key) =>
            searchParams.get(key),
        ),
    )
    if (queryMatch) {
        return queryMatch
    }

    const pathSegments = location.pathname.split('/').filter(Boolean)
    return matchFromCandidates(pathSegments)
}

const resolveSlugFromEnv = (): string => {
    const envMatch = matchFromCandidates([
        import.meta.env.VITE_CLIENT_SLUG,
        import.meta.env.CLIENT_SLUG,
    ])
    if (envMatch) {
        return envMatch
    }

    const urlMatch = getSlugFromUrl()
    if (urlMatch) {
        return urlMatch
    }

    return findAvailableSlug(FALLBACK_SLUG) ?? BASE_SLUG
}

const resolveModuleBySlug = (
    slug: string,
): ClientVariantConfig | undefined => {
    const key = `../clients/${slug}/config.ts`
    return clientModules[key]?.default
}

const ensureBaseConfig = (): ClientVariantConfig => {
    const base = resolveModuleBySlug(BASE_SLUG)
    if (!base) {
        throw new Error(
            '[client-config] No se encontró la configuración base en "../clients/core/config.ts".',
        )
    }
    return base
}

const baseConfig = ensureBaseConfig()
const currentSlug = resolveSlugFromEnv()
const overrideConfig =
    currentSlug === BASE_SLUG
        ? undefined
        : resolveModuleBySlug(currentSlug)

const mergedConfig = overrideConfig
    ? deepMerge<ClientVariantConfig>(baseConfig, overrideConfig)
    : deepMerge<ClientVariantConfig>(baseConfig, {})

export const clientConfig = Object.freeze({
    ...mergedConfig,
    slug: currentSlug,
    featureFlags: {
        ...baseConfig.featureFlags,
        ...overrideConfig?.featureFlags,
    },
}) as ClientVariantConfig

export const availableClientSlugs = [...resolvedAvailableClientSlugs]

export const applyClientRouteOverrides = (
    routes: Routes,
    group: ClientRouteGroup,
): Routes => {
    const override = clientConfig.frontend?.routes?.[group]
    if (!override) {
        return routes
    }

    const disabledKeys = new Set(override.disabledRouteKeys ?? [])
    const filtered = routes.filter((route) => !disabledKeys.has(route.key))

    const additions = override.additionalRoutes ?? []

    return [...filtered, ...additions]
}

export const getClientFeatureFlag = (
    feature: string,
    defaultValue = true,
): boolean => {
    const value = clientConfig.featureFlags?.[feature]
    if (value === undefined) {
        return defaultValue
    }
    return value
}
