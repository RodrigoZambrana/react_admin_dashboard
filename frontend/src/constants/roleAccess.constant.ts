import { ADMIN, ROLE_HIERARCHY, SUPERADMIN, USER, type Role } from './roles.constant'

export const FEATURES = {
    SALES: 'SALES',
    CUSTOMERS: 'CUSTOMERS',
    PRODUCTS: 'PRODUCTS',
    CALENDAR: 'CALENDAR',
    ACTIVITIES: 'ACTIVITIES',
    EXPENSES: 'EXPENSES',
    ACCOUNT: 'ACCOUNT',
    USERS: 'USERS',
    SETTINGS: 'SETTINGS',
} as const

export type Feature = (typeof FEATURES)[keyof typeof FEATURES]

export const FEATURE_LABELS: Record<Feature, string> = {
    [FEATURES.SALES]: 'Ventas',
    [FEATURES.CUSTOMERS]: 'Clientes',
    [FEATURES.PRODUCTS]: 'Productos',
    [FEATURES.CALENDAR]: 'Agenda',
    [FEATURES.ACTIVITIES]: 'Actividades',
    [FEATURES.EXPENSES]: 'Gastos',
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
    FEATURES.ACCOUNT,
]

const ADMIN_FEATURES: Feature[] = [FEATURES.USERS, FEATURES.SETTINGS]

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
    [ADMIN]: {
        inherits: [USER],
        features: ADMIN_FEATURES,
    },
    [SUPERADMIN]: {
        inherits: [ADMIN],
        features: 'ALL',
    },
}

const ALL_FEATURES: Feature[] = Object.values(FEATURES)

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
    FEATURE_ROLES[feature] ?? []
