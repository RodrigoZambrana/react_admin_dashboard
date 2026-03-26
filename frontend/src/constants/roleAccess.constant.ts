import {
    ADMIN,
    ROLE_HIERARCHY,
    SUPERADMIN,
    USER,
    OPS,
    SALES,
    FINANCE,
    type Role,
} from './roles.constant'

export const FEATURE_AUTHORITY_PREFIX = '__feature__:'

export const FEATURES = {
    SALES: 'SALES',
    CUSTOMERS: 'CUSTOMERS',
    PRODUCTS: 'PRODUCTS',
    CALENDAR: 'CALENDAR',
    ACTIVITIES: 'ACTIVITIES',
    EXPENSES: 'EXPENSES',
    ACCOUNTING: 'ACCOUNTING',
    ACCOUNT: 'ACCOUNT',
    USERS: 'USERS',
    SETTINGS: 'SETTINGS',
} as const

export type Feature = (typeof FEATURES)[keyof typeof FEATURES]

const FEATURE_CAPABILITY_GRANTS: Partial<Record<Feature, string[]>> = {
    [FEATURES.SALES]: ['quotes.manage', 'orders.manage', 'aberturas.quote'],
    [FEATURES.CUSTOMERS]: ['customers.manage', 'conversations.manage'],
    [FEATURES.PRODUCTS]: ['catalog.manage', 'aberturas.register'],
    [FEATURES.CALENDAR]: ['appointments.manage'],
    [FEATURES.ACTIVITIES]: ['appointments.manage'],
    [FEATURES.ACCOUNTING]: ['payments.manage'],
    [FEATURES.SETTINGS]: ['knowledge.manage', 'ai.settings.manage'],
}

export const FEATURE_LABELS: Record<Feature, string> = {
    [FEATURES.SALES]: 'Ventas',
    [FEATURES.CUSTOMERS]: 'Clientes',
    [FEATURES.PRODUCTS]: 'Productos',
    [FEATURES.CALENDAR]: 'Agenda',
    [FEATURES.ACTIVITIES]: 'Actividades',
    [FEATURES.EXPENSES]: 'Gastos',
    [FEATURES.ACCOUNTING]: 'Contabilidad',
    [FEATURES.ACCOUNT]: 'Cuenta',
    [FEATURES.USERS]: 'Usuarios',
    [FEATURES.SETTINGS]: 'Configuración',
}

const CORE_FEATURES: Feature[] = [
    FEATURES.SALES,
    FEATURES.CUSTOMERS,
    FEATURES.PRODUCTS,
    FEATURES.CALENDAR,
    FEATURES.ACTIVITIES,
    FEATURES.EXPENSES,
    FEATURES.ACCOUNTING,
    FEATURES.ACCOUNT,
]

const ADMIN_FEATURES: Feature[] = [FEATURES.USERS, FEATURES.SETTINGS]
const USER_MANAGEMENT_COMPAT_ROLES: Role[] = [
    OPS,
    SALES,
    FINANCE,
    ADMIN,
    SUPERADMIN,
]

type RoleGrant =
    | {
          inherits?: Role[]
          features: Feature[]
      }
    | {
          inherits?: Role[]
          features: 'ALL'
      }

const ROLE_GRANTS: Record<Role, RoleGrant> = {
    [USER]: {
        features: CORE_FEATURES,
    },
    [OPS]: {
        inherits: [USER],
        features: [],
    },
    [SALES]: {
        inherits: [USER],
        features: [],
    },
    [FINANCE]: {
        inherits: [USER],
        features: [FEATURES.ACCOUNTING, FEATURES.EXPENSES],
    },
    [ADMIN]: {
        inherits: [USER, OPS, SALES, FINANCE],
        features: ADMIN_FEATURES,
    },
    [SUPERADMIN]: {
        inherits: [ADMIN],
        features: 'ALL',
    },
}

const ALL_FEATURES: Feature[] = Object.values(FEATURES)

export const getFeatureAuthorityToken = (feature: Feature) =>
    `${FEATURE_AUTHORITY_PREFIX}${feature}`

export const isFeatureAuthorityToken = (value?: string | null): value is string =>
    String(value || '').startsWith(FEATURE_AUTHORITY_PREFIX)

export const resolveFeaturesFromCapabilityEnvelope = (
    capabilityEnvelope: string[] = [],
): Feature[] => {
    const grants = new Set(capabilityEnvelope)

    return ALL_FEATURES.filter((feature) =>
        (FEATURE_CAPABILITY_GRANTS[feature] ?? []).some((capability) =>
            grants.has(capability),
        ),
    )
}

export const getFeatureAuthoritiesForCapabilityEnvelope = (
    capabilityEnvelope: string[] = [],
) =>
    resolveFeaturesFromCapabilityEnvelope(capabilityEnvelope).map((feature) =>
        getFeatureAuthorityToken(feature),
    )

const resolveFeaturesForRole = (
    role: Role,
    visited = new Set<Role>(),
): Feature[] => {
    if (visited.has(role)) {
        return []
    }
    visited.add(role)
    const config = ROLE_GRANTS[role]
    if (!config) {
        return []
    }

    if (config.features === 'ALL') {
        return ALL_FEATURES
    }

    const inherited =
        config.inherits?.flatMap((parent) =>
            resolveFeaturesForRole(parent, visited),
        ) ?? []

    const combined = [...inherited, ...config.features]

    return Array.from(new Set(combined))
}

export const ROLE_FEATURES: Record<Role, Feature[]> = ROLE_HIERARCHY.reduce(
    (acc, role) => {
        acc[role] = resolveFeaturesForRole(role)
        return acc
    },
    {} as Record<Role, Feature[]>,
)

export const FEATURE_ROLES: Record<Feature, Role[]> = ALL_FEATURES.reduce(
    (acc, feature) => {
        acc[feature] = ROLE_HIERARCHY.filter((role) =>
            ROLE_FEATURES[role].includes(feature),
        )
        return acc
    },
    {} as Record<Feature, Role[]>,
)

export const getFeaturesForRole = (role: Role): Feature[] =>
    ROLE_FEATURES[role] ?? []

export const getRolesForFeature = (feature: Feature): Role[] =>
    [
        ...(feature === FEATURES.USERS
            ? USER_MANAGEMENT_COMPAT_ROLES
            : FEATURE_ROLES[feature] ?? []),
        ...((FEATURE_CAPABILITY_GRANTS[feature]?.length ?? 0) > 0
            ? [getFeatureAuthorityToken(feature) as Role]
            : []),
    ] as Role[]
