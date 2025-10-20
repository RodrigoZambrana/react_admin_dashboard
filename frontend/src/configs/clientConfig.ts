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

const DEFAULT_SLUG = 'core'

const clientModules = import.meta.glob<ClientModule>(
    '../clients/*/config.ts',
    { eager: true },
)

const sanitiseSlug = (slug: string): string =>
    slug.replace(/[^a-z0-9_-]/gi, '')

const resolveSlugFromEnv = (): string => {
    const slug = import.meta.env.VITE_CLIENT_SLUG
    if (typeof slug !== 'string' || !slug.trim()) {
        return DEFAULT_SLUG
    }
    return sanitiseSlug(slug.trim())
}

const resolveModuleBySlug = (
    slug: string,
): ClientVariantConfig | undefined => {
    const key = `../clients/${slug}/config.ts`
    return clientModules[key]?.default
}

const ensureBaseConfig = (): ClientVariantConfig => {
    const base = resolveModuleBySlug(DEFAULT_SLUG)
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
    currentSlug === DEFAULT_SLUG
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

export const availableClientSlugs = Array.from(
    new Set(
        Object.keys(clientModules).map((key) => {
            const normalised = key.replace(/\\/g, '/')
            return normalised.replace('../clients/', '').split('/')[0]
        }),
    ),
)

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
