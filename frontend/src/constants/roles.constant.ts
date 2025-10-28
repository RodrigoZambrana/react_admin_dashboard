export const ROLES = {
    SUPERADMIN: 'SUPERADMIN',
    ADMIN: 'ADMIN',
    OPS: 'OPS',
    SALES: 'SALES',
    FINANCE: 'FINANCE',
    USER: 'USER',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const SUPERADMIN = ROLES.SUPERADMIN
export const ADMIN = ROLES.ADMIN
export const OPS = ROLES.OPS
export const SALES = ROLES.SALES
export const FINANCE = ROLES.FINANCE
export const USER = ROLES.USER

export const ROLE_LABELS: Record<Role, string> = {
    [SUPERADMIN]: 'Super Admin',
    [ADMIN]: 'Admin',
    [OPS]: 'Operations',
    [SALES]: 'Sales',
    [FINANCE]: 'Finance',
    [USER]: 'User',
}

export const ROLE_HIERARCHY: Role[] = [USER, OPS, SALES, FINANCE, ADMIN, SUPERADMIN]

export const ROLE_OPTIONS = ROLE_HIERARCHY.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
}))
