import { inspect } from 'node:util'
import {
  assertMaintenanceScriptSafety,
  loadEnvFromBackendRoot,
} from './script-safety'

type ScriptArgs = {
  apiBaseUrl: string
  aiAgentBaseUrl: string
  adminEmail: string
  adminPassword: string
  tenantKey: string
  dryRun: boolean
}

type QuoteProfileAttributeOption = {
  value: string
  aliases?: string[]
}

type QuoteProfileAttribute = {
  key: string
  label: string
  required: boolean
  captureKind: 'measurements' | 'quantity' | 'taxonomy_tag' | 'enum'
  taxonomyTag?: string | null
  subjectPrefix?: string | null
  options?: QuoteProfileAttributeOption[]
}

type QuoteProfilePayload = {
  key: string
  label: string
  appliesToTopicKeys?: string[]
  appliesToTopicLabels?: string[]
  familyLabel?: string | null
  pricingStrategy:
    | 'handoff_only'
    | 'immediate_unit_price'
    | 'immediate_square_meter'
    | 'parametric_exact_or_handoff'
  closureMode: 'collect_then_handoff' | 'collect_then_price_or_handoff'
  measurementCarrierTerms?: string[]
  attributes: QuoteProfileAttribute[]
}

type TopicTaxonomyItem = {
  key: string
  label: string
  kind: 'product_family' | 'product_topic' | 'product_variant'
  aliases: string[]
  normalizationValue?: string | null
  parentKeys?: string[]
  parentLabels?: string[]
  familyLabel?: string | null
  tags?: string[]
}

const SCRIPT_NAME = 'sync-urucortinas-curation'
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4000/api'
const DEFAULT_AI_AGENT_BASE_URL = 'http://127.0.0.1:4100'
const DEFAULT_ADMIN_EMAIL =
  process.env.PLAYWRIGHT_ADMIN_EMAIL ||
  process.env.DEFAULT_ADMIN_EMAIL ||
  'desarrollo@software-strategy.com'
const DEFAULT_ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD ||
  process.env.DEFAULT_ADMIN_PASSWORD ||
  'LocalAdmin123!'
const DEFAULT_TENANT_KEY = 'urucortinas'
const CUSTOMER_SCOPE = 'customer_public'
const TAXONOMY_DOC_TITLE =
  'Taxonomía customer · Urucortinas · Ventanas corredizas publicadas'
const DEFAULT_MEASUREMENT_CARRIER_TERMS = [
  'ventana',
  'ventanas',
  'puerta',
  'puertas',
  'vano',
  'vanos',
  'hueco',
  'huecos',
  'pano',
  'panos',
]

const normalizeText = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeKnowledgeSignal = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const dedupeStrings = (values: Array<unknown>) => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const value = normalizeText(raw)
    const key = normalizeKnowledgeSignal(value)
    if (!value || !key || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(value)
  }
  return result
}

function parseArgs(argv: string[], dryRun: boolean): ScriptArgs {
  const readFlag = (name: string) => {
    const index = argv.findIndex((entry) => entry === name)
    if (index === -1) {
      return null
    }
    return argv[index + 1] || null
  }

  return {
    apiBaseUrl: (readFlag('--api-base') || DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
    aiAgentBaseUrl: (
      readFlag('--ai-agent-base') || DEFAULT_AI_AGENT_BASE_URL
    ).replace(/\/+$/, ''),
    adminEmail: readFlag('--email') || DEFAULT_ADMIN_EMAIL,
    adminPassword: readFlag('--password') || DEFAULT_ADMIN_PASSWORD,
    tenantKey: readFlag('--tenant') || DEFAULT_TENANT_KEY,
    dryRun,
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; data: T }> {
  const response = await fetch(url, init)
  const text = await response.text()
  const data = text ? (JSON.parse(text) as T) : (null as T)
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${url}: ${typeof data === 'string' ? data : inspect(data, { depth: 5 })}`,
    )
  }
  return {
    status: response.status,
    data,
  }
}

async function signInAdmin(args: ScriptArgs) {
  const { data } = await requestJson<{
    token?: string
    accessToken?: string
    data?: { token?: string; accessToken?: string }
  }>(`${args.apiBaseUrl}/sign-in`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: args.adminEmail,
      password: args.adminPassword,
    }),
  })

  const token =
    data?.token || data?.accessToken || data?.data?.token || data?.data?.accessToken
  if (!token) {
    throw new Error('Could not resolve admin JWT token from sign-in response.')
  }
  return token
}

const buildHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
})

async function getManagedQuoteProfiles(args: ScriptArgs, token: string) {
  const url = new URL(`${args.apiBaseUrl}/ai/knowledge/quote-profiles/manage`)
  url.searchParams.set('tenantKey', args.tenantKey)
  url.searchParams.set('scope', CUSTOMER_SCOPE)
  return requestJson<{
    tenantKey: string
    scope: string
    document: {
      id: string
      title: string
      summary?: string | null
      content?: string | null
      tags?: string[]
    } | null
    items: Array<Record<string, unknown>>
  }>(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

async function listManagedKnowledgeDocuments(
  args: ScriptArgs,
  token: string,
  search: string,
) {
  const url = new URL(`${args.apiBaseUrl}/ai/knowledge/documents`)
  url.searchParams.set('tenantKey', args.tenantKey)
  url.searchParams.set('scope', CUSTOMER_SCOPE)
  url.searchParams.set('sourceType', 'admin_curated')
  url.searchParams.set('pageSize', '200')
  url.searchParams.set('search', search)
  return requestJson<{
    items?: Array<{
      id: string
      title: string
      summary?: string | null
      tags?: string[]
      metadata?: Record<string, unknown> | null
      status?: string
    }>
  }>(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

const buildWindowPublishedTaxonomyItems = (): TopicTaxonomyItem[] => [
  {
    key: 'product_topic:ventanas-corredizas',
    label: 'ventanas corredizas',
    kind: 'product_topic',
    aliases: [
      'ventana corrediza',
      'ventanas corredizas',
      'abertura corrediza',
      'aberturas corredizas',
      'ventana corrediza de aluminio',
      'ventanas corredizas de aluminio',
    ],
    normalizationValue: 'ventana corrediza',
    parentKeys: ['product_family:aberturas'],
    parentLabels: ['aberturas'],
    familyLabel: 'aberturas',
    tags: [
      'customer',
      'topic',
      'quote_requires_measurements',
      'quote_requires_quantity',
      'quote_requires_series',
      'quote_requires_glass',
      'quote_requires_color',
    ],
  },
  {
    key: 'product_variant:serie-20',
    label: '20',
    kind: 'product_variant',
    aliases: ['20', 'serie 20', 'linea 20', 'línea 20'],
    normalizationValue: '20',
    parentKeys: [
      'product_topic:ventanas-corredizas',
      'product_topic:aberturas-de-aluminio',
      'product_family:aberturas',
    ],
    parentLabels: ['ventanas corredizas', 'aberturas de aluminio', 'aberturas'],
    familyLabel: 'aberturas',
    tags: ['customer', 'variant', 'quote_slot_series'],
  },
]

const buildWindowPublishedTaxonomyContent = (items: TopicTaxonomyItem[]) => {
  const lines = [
    '# Taxonomía customer derivada para ventanas publicadas',
    '',
    'Documento curado para reforzar la detección de ventanas corredizas publicadas con precio inmediato en Urucortinas.',
    '',
  ]

  for (const item of items) {
    lines.push(`## ${item.label}`)
    lines.push(`- Key: ${item.key}`)
    lines.push(`- Kind: ${item.kind}`)
    lines.push(`- Familia: ${item.familyLabel || 'sin familia'}`)
    if (item.parentKeys?.length) {
      lines.push(`- Parent keys: ${item.parentKeys.join(', ')}`)
    }
    if (item.aliases?.length) {
      lines.push(`- Aliases: ${item.aliases.join(', ')}`)
    }
    if (item.tags?.length) {
      lines.push(`- Tags: ${item.tags.join(', ')}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

const buildWindowsPublishedProfile = (): QuoteProfilePayload => ({
  key: 'quote_profile:ventanas_corredizas_publicadas',
  label: 'Ventanas corredizas publicadas',
  appliesToTopicKeys: ['product_topic:ventanas-corredizas'],
  appliesToTopicLabels: [
    'ventanas corredizas',
    'ventana corrediza',
  ],
  familyLabel: 'aberturas',
  pricingStrategy: 'immediate_unit_price',
  closureMode: 'collect_then_price_or_handoff',
  measurementCarrierTerms: [...DEFAULT_MEASUREMENT_CARRIER_TERMS],
  attributes: [
    {
      key: 'measurements',
      label: 'las medidas aproximadas (ancho por alto)',
      required: true,
      captureKind: 'measurements',
    },
    {
      key: 'quantity',
      label: 'cuántas unidades necesitás',
      required: true,
      captureKind: 'quantity',
    },
    {
      key: 'series',
      label: 'la serie',
      required: true,
      captureKind: 'taxonomy_tag',
      taxonomyTag: 'quote_slot_series',
      subjectPrefix: 'serie',
    },
    {
      key: 'glass',
      label: 'el tipo de vidrio',
      required: true,
      captureKind: 'enum',
      subjectPrefix: 'con',
      options: [
        {
          value: '3mm',
          aliases: ['3mm', 'simple 3mm', 'v3mm', 'vidrio 3mm'],
        },
        {
          value: '4mm',
          aliases: ['4mm', 'simple 4mm', 'v4mm', 'vidrio 4mm'],
        },
        {
          value: 'dvh',
          aliases: [
            'dvh',
            'doble vidrio',
            'doble vidriado',
            'doble vidrio hermetico',
            'doble vidriado hermetico',
          ],
        },
      ],
    },
    {
      key: 'color',
      label: 'el color',
      required: true,
      captureKind: 'enum',
      subjectPrefix: 'color',
      options: [
        {
          value: 'blanco',
          aliases: ['blanca', 'blancas', 'blanco', 'blancos'],
        },
        {
          value: 'natural',
          aliases: ['natural', 'natural anodizado', 'aluminio natural'],
        },
        {
          value: 'negro',
          aliases: ['negra', 'negras', 'negro', 'negros'],
        },
        {
          value: 'gris',
          aliases: ['gris', 'gris plata', 'grises'],
        },
        {
          value: 'bronce',
          aliases: ['bronce'],
        },
      ],
    },
  ],
})

const normalizeAttribute = (attribute: Record<string, unknown>): QuoteProfileAttribute => ({
  key: normalizeText(attribute.key),
  label: normalizeText(attribute.label),
  required: attribute.required !== false,
  captureKind: String(attribute.captureKind || 'enum') as QuoteProfileAttribute['captureKind'],
  taxonomyTag:
    typeof attribute.taxonomyTag === 'string' && attribute.taxonomyTag.trim()
      ? attribute.taxonomyTag.trim()
      : null,
  subjectPrefix:
    typeof attribute.subjectPrefix === 'string' && attribute.subjectPrefix.trim()
      ? attribute.subjectPrefix.trim()
      : null,
  options: Array.isArray(attribute.options)
    ? attribute.options.reduce<QuoteProfileAttributeOption[]>((result, option) => {
        const raw = option as Record<string, unknown>
        const value = normalizeText(raw.value)
        if (!value) {
          return result
        }
        result.push({
          value,
          aliases: dedupeStrings(Array.isArray(raw.aliases) ? raw.aliases : []),
        })
        return result
      }, [])
    : [],
})

const normalizeProfile = (profile: Record<string, unknown>): QuoteProfilePayload => ({
  key: normalizeText(profile.key),
  label: normalizeText(profile.label),
  appliesToTopicKeys: dedupeStrings(
    Array.isArray(profile.appliesToTopicKeys) ? profile.appliesToTopicKeys : [],
  ),
  appliesToTopicLabels: dedupeStrings(
    Array.isArray(profile.appliesToTopicLabels) ? profile.appliesToTopicLabels : [],
  ),
  familyLabel: normalizeText(profile.familyLabel) || null,
  pricingStrategy: String(profile.pricingStrategy || 'handoff_only') as QuoteProfilePayload['pricingStrategy'],
  closureMode: String(profile.closureMode || 'collect_then_handoff') as QuoteProfilePayload['closureMode'],
  measurementCarrierTerms: dedupeStrings(
    Array.isArray(profile.measurementCarrierTerms)
      ? profile.measurementCarrierTerms
      : DEFAULT_MEASUREMENT_CARRIER_TERMS,
  ),
  attributes: Array.isArray(profile.attributes)
    ? profile.attributes.map((entry) => normalizeAttribute(entry as Record<string, unknown>))
    : [],
})

const ensureOptionValue = (
  attribute: QuoteProfileAttribute,
  requiredOption: QuoteProfileAttributeOption,
) => {
  const normalizedValue = normalizeKnowledgeSignal(requiredOption.value)
  const existing = (attribute.options || []).find(
    (option) => normalizeKnowledgeSignal(option.value) === normalizedValue,
  )
  if (!existing) {
    attribute.options = [...(attribute.options || []), requiredOption]
    return
  }
  existing.aliases = dedupeStrings([...(existing.aliases || []), ...(requiredOption.aliases || [])])
}

const mergeUrucortinasQuoteProfiles = (
  currentProfiles: Array<Record<string, unknown>>,
) => {
  const profiles = currentProfiles.map((profile) => normalizeProfile(profile))
  const byKey = new Map(profiles.map((profile) => [profile.key, profile]))

  const aberturas = byKey.get('quote_profile:aberturas')
  if (aberturas) {
    const glassAttribute = aberturas.attributes.find((attribute) => attribute.key === 'glass')
    if (glassAttribute) {
      ensureOptionValue(glassAttribute, {
        value: '3mm',
        aliases: ['3mm', 'simple 3mm', 'v3mm', 'vidrio 3mm'],
      })
    }
    const colorAttribute = aberturas.attributes.find((attribute) => attribute.key === 'color')
    if (colorAttribute) {
      ensureOptionValue(colorAttribute, {
        value: 'natural',
        aliases: ['natural', 'natural anodizado', 'aluminio natural'],
      })
    }
  }

  byKey.set(
    'quote_profile:ventanas_corredizas_publicadas',
    buildWindowsPublishedProfile(),
  )

  return Array.from(byKey.values()).sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
  )
}

async function upsertQuoteProfiles(args: ScriptArgs, token: string) {
  const managed = await getManagedQuoteProfiles(args, token)
  const payload = {
    documentId: managed.data.document?.id,
    tenantKey: args.tenantKey,
    scope: CUSTOMER_SCOPE,
    title: managed.data.document?.title || 'Perfiles de cotización · Urucortinas',
    summary:
      managed.data.document?.summary ||
      'Perfiles curados para intake de presupuestos por tipo de producto y cierre operativo sin inventar precios.',
    tags:
      managed.data.document?.tags && managed.data.document.tags.length
        ? managed.data.document.tags
        : ['tenant-quote-profiles', 'customer-quote', 'urucortinas', 'manual_entry'],
    profiles: mergeUrucortinasQuoteProfiles(managed.data.items || []),
  }

  if (args.dryRun) {
    console.log('[dry-run] quote profiles payload')
    console.log(inspect(payload, { depth: 8, colors: false, maxArrayLength: null }))
    return payload
  }

  const { data } = await requestJson(`${args.apiBaseUrl}/ai/knowledge/quote-profiles/manage`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })
  return data
}

async function upsertWindowPublishedTaxonomy(args: ScriptArgs, token: string) {
  const taxonomyItems = buildWindowPublishedTaxonomyItems()
  const content = buildWindowPublishedTaxonomyContent(taxonomyItems)
  const existingDocs = await listManagedKnowledgeDocuments(args, token, 'Ventanas corredizas publicadas')
  const existingDocument =
    (existingDocs.data.items || []).find(
      (item) =>
        normalizeText(item.title) === TAXONOMY_DOC_TITLE &&
        item.metadata &&
        (item.metadata as Record<string, unknown>).sourceKind === 'tenant_topic_taxonomy',
    ) || null

  const payload = {
    tenantKey: args.tenantKey,
    scope: CUSTOMER_SCOPE,
    title: TAXONOMY_DOC_TITLE,
    summary:
      'Refuerza la detección de ventanas corredizas publicadas con precio inmediato y la serie 20.',
    content,
    tags: [
      'tenant-taxonomy',
      'customer-normalization',
      'customer-topics',
      'customer-quote',
      'urucortinas',
      'ventanas-publicadas',
    ],
    metadata: {
      source: 'admin-api-script',
      sourceKind: 'tenant_topic_taxonomy',
      topicTaxonomy: taxonomyItems,
    },
  }

  if (args.dryRun) {
    console.log('[dry-run] taxonomy payload')
    console.log(inspect({ existingDocumentId: existingDocument?.id || null, ...payload }, { depth: 8, colors: false, maxArrayLength: null }))
    return { existingDocumentId: existingDocument?.id || null, payload }
  }

  if (existingDocument) {
    const { data } = await requestJson(
      `${args.apiBaseUrl}/ai/knowledge/documents/${existingDocument.id}`,
      {
        method: 'PATCH',
        headers: buildHeaders(token),
        body: JSON.stringify({
          title: payload.title,
          summary: payload.summary,
          content: payload.content,
          tags: payload.tags,
          metadata: payload.metadata,
          scope: CUSTOMER_SCOPE,
          status: 'active',
        }),
      },
    )
    return data
  }

  const { data } = await requestJson(`${args.apiBaseUrl}/ai/knowledge/curated`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  })
  return data
}

async function refreshAiAgentCache(args: ScriptArgs) {
  if (args.dryRun) {
    console.log('[dry-run] would refresh ai-agent cache')
    return null
  }

  const { data } = await requestJson(`${args.aiAgentBaseUrl}/cache/refresh`, {
    method: 'POST',
    headers: {
      'x-ai-internal-token': process.env.AI_INTERNAL_TOKEN || 'local-ai-internal-token',
    },
  })
  return data
}

async function main() {
  loadEnvFromBackendRoot()
  const safety = assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    argv: process.argv.slice(2),
    destructive: true,
    defaultDryRun: true,
  })
  const args = parseArgs(process.argv.slice(2), safety.dryRun)
  const token = await signInAdmin(args)

  console.log(
    `[${SCRIPT_NAME}] tenant=${args.tenantKey} api=${args.apiBaseUrl} ai-agent=${args.aiAgentBaseUrl} dryRun=${String(
      args.dryRun,
    )}`,
  )

  await upsertQuoteProfiles(args, token)
  await upsertWindowPublishedTaxonomy(args, token)
  await refreshAiAgentCache(args)

  console.log(
    `[${SCRIPT_NAME}] ${
      args.dryRun
        ? 'Dry-run complete. Re-run with --confirm to apply.'
        : 'Sync applied successfully.'
    }`,
  )
}

main().catch((error) => {
  console.error(`[${SCRIPT_NAME}] failed`, error)
  process.exitCode = 1
})
