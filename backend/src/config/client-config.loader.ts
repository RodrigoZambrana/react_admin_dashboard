import { existsSync } from 'fs'
import * as path from 'path'
import { BASE_CLIENT_SLUG, FALLBACK_CLIENT_SLUG } from './client-config.constants'
import type { ClientVariantConfig } from './client-config.types'

type PlainObject = Record<string, unknown>

const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.cjs', '.mjs']

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const deepMerge = (
  base: PlainObject,
  override: PlainObject,
): PlainObject => {
  const result: PlainObject = { ...base }

  Object.entries(override).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }

    const current = result[key]

    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(
        current as PlainObject,
        value as PlainObject,
      )
      return
    }

    result[key] = value
  })

  return result
}

const resolveClientConfigPath = (slug: string): string | null => {
  const baseDir = path.resolve(__dirname, '..', 'clients', slug)

  for (const extension of SUPPORTED_EXTENSIONS) {
    const candidate = path.resolve(baseDir, `config${extension}`)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

const loadRawClientConfig = (
  slug: string,
): Partial<ClientVariantConfig> => {
  const filePath = resolveClientConfigPath(slug)

  if (!filePath) {
    if (slug !== BASE_CLIENT_SLUG) {
      // eslint-disable-next-line no-console
      console.warn(
        `[client-config] No se encontró configuración para el cliente "${slug}". Se utilizará la variante base.`,
      )
    }
    return {}
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
    const moduleExport = require(filePath)
    const config = (moduleExport?.default ?? moduleExport) as
      | Partial<ClientVariantConfig>
      | undefined

    if (!config || !isPlainObject(config)) {
      throw new Error('El archivo no exporta un objeto de configuración válido.')
    }

    return config
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[client-config] Error cargando la configuración para "${slug}":`,
      error,
    )
    return {}
  }
}

export const loadClientConfig = (
  explicitSlug?: string,
): ClientVariantConfig => {
  const resolvedSlug =
    explicitSlug || process.env.CLIENT_SLUG || FALLBACK_CLIENT_SLUG

  const baseConfig = loadRawClientConfig(BASE_CLIENT_SLUG)
  const overrideConfig =
    resolvedSlug === BASE_CLIENT_SLUG
      ? {}
      : loadRawClientConfig(resolvedSlug)

  const merged = deepMerge(
    baseConfig as PlainObject,
    overrideConfig as PlainObject,
  ) as Partial<ClientVariantConfig>

  return Object.freeze({
    ...merged,
    slug: resolvedSlug,
    displayName:
      overrideConfig.displayName ||
      merged.displayName ||
      baseConfig.displayName ||
      resolvedSlug,
  })
}
