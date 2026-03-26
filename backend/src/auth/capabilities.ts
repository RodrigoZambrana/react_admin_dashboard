import { ROLES, type Role } from './roles.decorator'

export const USER_CAPABILITIES = [
  'conversations.manage',
  'customers.manage',
  'appointments.manage',
  'catalog.manage',
  'orders.manage',
  'quotes.manage',
  'payments.manage',
  'aberturas.quote',
  'aberturas.register',
  'knowledge.manage',
  'ai.settings.manage',
  'users.manage',
] as const

export type UserCapabilityKey = (typeof USER_CAPABILITIES)[number]

export const USER_CAPABILITY_GROUPS = [
  'support',
  'sales',
  'operations',
  'finance',
  'platform_admin',
] as const

export type UserCapabilityGroupKey = (typeof USER_CAPABILITY_GROUPS)[number]

export type CapabilityEnvelopeSource =
  | 'superadmin'
  | 'explicit'
  | 'legacy_role'
  | 'none'

type CapabilityDefinition = {
  value: UserCapabilityKey
  label: string
  description: string
}

type CapabilityGroupDefinition = {
  value: UserCapabilityGroupKey
  label: string
  description: string
  capabilities: UserCapabilityKey[]
}

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    value: 'conversations.manage',
    label: 'Mensajería e inbox',
    description:
      'Gestiona conversaciones, takeover, handoff y operación diaria del inbox admin.',
  },
  {
    value: 'customers.manage',
    label: 'Clientes',
    description: 'Busca, crea y actualiza clientes desde la operativa administrativa.',
  },
  {
    value: 'appointments.manage',
    label: 'Actividades',
    description: 'Crea, edita y elimina actividades, citas o seguimientos operativos.',
  },
  {
    value: 'catalog.manage',
    label: 'Catálogo',
    description:
      'Administra productos, categorías, publicación, stock y cambios operativos del catálogo.',
  },
  {
    value: 'orders.manage',
    label: 'Pedidos',
    description: 'Crea y actualiza pedidos, estados, comentarios y estructura documental.',
  },
  {
    value: 'quotes.manage',
    label: 'Presupuestos',
    description:
      'Crea y actualiza presupuestos, envíos, confirmaciones y estructura comercial.',
  },
  {
    value: 'payments.manage',
    label: 'Pagos',
    description: 'Registra y actualiza pagos, estados y datos asociados.',
  },
  {
    value: 'aberturas.quote',
    label: 'Cotización de aberturas',
    description:
      'Permite preparar y operar cotizaciones estructuradas del flujo de aberturas.',
  },
  {
    value: 'aberturas.register',
    label: 'Alta de aberturas',
    description:
      'Permite preparar payloads estructurados para alta operativa de aberturas en el sistema.',
  },
  {
    value: 'knowledge.manage',
    label: 'Knowledge base',
    description:
      'Administra documentos aprobados, ingesta curada y contexto base para la IA.',
  },
  {
    value: 'ai.settings.manage',
    label: 'Configuración IA',
    description:
      'Gestiona settings de runtime, prompts, proveedor y comportamiento operativo de IA.',
  },
  {
    value: 'users.manage',
    label: 'Usuarios y permisos',
    description:
      'Crea usuarios administrativos y define grupos/capacidades operativas.',
  },
]

const GROUP_DEFINITIONS: CapabilityGroupDefinition[] = [
  {
    value: 'support',
    label: 'Soporte',
    description:
      'Operativa de atención, seguimiento y coordinación interna sobre clientes y conversaciones.',
    capabilities: [
      'conversations.manage',
      'customers.manage',
      'appointments.manage',
      'orders.manage',
      'quotes.manage',
    ],
  },
  {
    value: 'sales',
    label: 'Ventas',
    description:
      'Operativa comercial sobre clientes, presupuestos y cotización estructurada de aberturas.',
    capabilities: [
      'conversations.manage',
      'customers.manage',
      'orders.manage',
      'quotes.manage',
      'aberturas.quote',
    ],
  },
  {
    value: 'operations',
    label: 'Operaciones',
    description:
      'Operativa de ejecución, catálogo, pedidos, pagos y alta estructurada de aberturas.',
    capabilities: [
      'conversations.manage',
      'customers.manage',
      'appointments.manage',
      'catalog.manage',
      'orders.manage',
      'payments.manage',
      'aberturas.quote',
      'aberturas.register',
    ],
  },
  {
    value: 'finance',
    label: 'Finanzas',
    description:
      'Seguimiento administrativo de clientes, pedidos, presupuestos y pagos.',
    capabilities: [
      'conversations.manage',
      'customers.manage',
      'orders.manage',
      'quotes.manage',
      'payments.manage',
    ],
  },
  {
    value: 'platform_admin',
    label: 'Administrador de plataforma',
    description:
      'Acceso transversal a capacidades operativas, knowledge, IA y gestión de usuarios.',
    capabilities: [...USER_CAPABILITIES],
  },
]

const LEGACY_ROLE_GROUPS: Record<Role, UserCapabilityGroupKey[]> = {
  [ROLES.SUPERADMIN]: ['platform_admin'],
  [ROLES.ADMIN]: ['platform_admin'],
  [ROLES.USER]: [],
  [ROLES.OPS]: ['operations'],
  [ROLES.SALES]: ['sales'],
  [ROLES.FINANCE]: ['finance'],
}

const CAPABILITY_TO_PRISMA_ENUM: Record<UserCapabilityKey, string> = {
  'conversations.manage': 'CONVERSATIONS_MANAGE',
  'customers.manage': 'CUSTOMERS_MANAGE',
  'appointments.manage': 'APPOINTMENTS_MANAGE',
  'catalog.manage': 'CATALOG_MANAGE',
  'orders.manage': 'ORDERS_MANAGE',
  'quotes.manage': 'QUOTES_MANAGE',
  'payments.manage': 'PAYMENTS_MANAGE',
  'aberturas.quote': 'ABERTURAS_QUOTE',
  'aberturas.register': 'ABERTURAS_REGISTER',
  'knowledge.manage': 'KNOWLEDGE_MANAGE',
  'ai.settings.manage': 'AI_SETTINGS_MANAGE',
  'users.manage': 'USERS_MANAGE',
}

const CAPABILITY_FROM_PRISMA_ENUM = Object.fromEntries(
  Object.entries(CAPABILITY_TO_PRISMA_ENUM).map(([key, value]) => [value, key]),
) as Record<string, UserCapabilityKey>

const GROUP_TO_PRISMA_ENUM: Record<UserCapabilityGroupKey, string> = {
  support: 'SUPPORT',
  sales: 'SALES',
  operations: 'OPERATIONS',
  finance: 'FINANCE',
  platform_admin: 'PLATFORM_ADMIN',
}

const GROUP_FROM_PRISMA_ENUM = Object.fromEntries(
  Object.entries(GROUP_TO_PRISMA_ENUM).map(([key, value]) => [value, key]),
) as Record<string, UserCapabilityGroupKey>

export const isUserCapability = (value?: string | null): value is UserCapabilityKey =>
  USER_CAPABILITIES.includes(String(value || '').trim() as UserCapabilityKey)

export const isUserCapabilityGroup = (
  value?: string | null,
): value is UserCapabilityGroupKey =>
  USER_CAPABILITY_GROUPS.includes(
    String(value || '').trim() as UserCapabilityGroupKey,
  )

export const mapCapabilityToPrismaEnum = (value: UserCapabilityKey) =>
  CAPABILITY_TO_PRISMA_ENUM[value]

export const mapCapabilityFromPrismaEnum = (
  value?: string | null,
): UserCapabilityKey | null => {
  const normalized = String(value || '').trim().toUpperCase()
  return CAPABILITY_FROM_PRISMA_ENUM[normalized] ?? null
}

export const mapCapabilityGroupToPrismaEnum = (value: UserCapabilityGroupKey) =>
  GROUP_TO_PRISMA_ENUM[value]

export const mapCapabilityGroupFromPrismaEnum = (
  value?: string | null,
): UserCapabilityGroupKey | null => {
  const normalized = String(value || '').trim().toUpperCase()
  return GROUP_FROM_PRISMA_ENUM[normalized] ?? null
}

export const normalizeCapabilityList = (
  values?: Iterable<string | null | undefined> | null,
): UserCapabilityKey[] =>
  Array.from(
    new Set(
      Array.from(values ?? [])
        .map((value) => String(value || '').trim())
        .map((value) => mapCapabilityFromPrismaEnum(value) ?? value)
        .filter(isUserCapability),
    ),
  )

export const normalizeCapabilityGroupList = (
  values?: Iterable<string | null | undefined> | null,
): UserCapabilityGroupKey[] =>
  Array.from(
    new Set(
      Array.from(values ?? [])
        .map((value) => String(value || '').trim())
        .map((value) => mapCapabilityGroupFromPrismaEnum(value) ?? value)
        .filter(isUserCapabilityGroup),
    ),
  )

export const resolveCapabilitiesFromGroups = (
  groups?: Iterable<UserCapabilityGroupKey> | null,
): UserCapabilityKey[] => {
  const resolved = new Set<UserCapabilityKey>()
  for (const group of normalizeCapabilityGroupList(groups)) {
    const definition = GROUP_DEFINITIONS.find((entry) => entry.value === group)
    for (const capability of definition?.capabilities ?? []) {
      resolved.add(capability)
    }
  }
  return Array.from(resolved)
}

export const getCapabilityCatalog = () => ({
  capabilities: CAPABILITY_DEFINITIONS.map((entry) => ({ ...entry })),
  groups: GROUP_DEFINITIONS.map((entry) => ({ ...entry, capabilities: [...entry.capabilities] })),
  legacyRoleDefaults: Object.entries(LEGACY_ROLE_GROUPS).map(([role, groups]) => ({
    role,
    groups: [...groups],
    capabilities: resolveCapabilitiesFromGroups(groups),
  })),
})

export const resolveUserCapabilityEnvelope = (input?: {
  role?: Role | string | null
  capabilityGroups?: Iterable<string | null | undefined> | null
  directCapabilities?: Iterable<string | null | undefined> | null
}) => {
  const normalizedRole = String(input?.role || '').trim().toUpperCase() as Role
  const capabilityGroups = normalizeCapabilityGroupList(input?.capabilityGroups)
  const directCapabilities = normalizeCapabilityList(input?.directCapabilities)
  const explicitConfigured =
    capabilityGroups.length > 0 || directCapabilities.length > 0

  if (normalizedRole === ROLES.SUPERADMIN) {
    return {
      capabilityGroups,
      directCapabilities,
      capabilityEnvelope: [...USER_CAPABILITIES],
      source: 'superadmin' as CapabilityEnvelopeSource,
    }
  }

  if (explicitConfigured) {
    return {
      capabilityGroups,
      directCapabilities,
      capabilityEnvelope: Array.from(
        new Set([
          ...resolveCapabilitiesFromGroups(capabilityGroups),
          ...directCapabilities,
        ]),
      ),
      source: 'explicit' as CapabilityEnvelopeSource,
    }
  }

  const legacyGroups = LEGACY_ROLE_GROUPS[normalizedRole] ?? []
  const legacyCapabilities = resolveCapabilitiesFromGroups(legacyGroups)

  return {
    capabilityGroups,
    directCapabilities,
    capabilityEnvelope: legacyCapabilities,
    source: legacyCapabilities.length ? ('legacy_role' as CapabilityEnvelopeSource) : ('none' as CapabilityEnvelopeSource),
  }
}

export const hasCapability = (
  envelope: Iterable<string | null | undefined> | null | undefined,
  capability: UserCapabilityKey,
) => normalizeCapabilityList(envelope).includes(capability)
