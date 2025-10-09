export const ROLES = {
    SUPERADMIN: 'SUPERADMIN',
    ADMIN: 'ADMIN',
    USER: 'USER',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const SUPERADMIN = ROLES.SUPERADMIN
export const ADMIN = ROLES.ADMIN
export const USER = ROLES.USER

export const ROLE_LABELS: Record<Role, string> = {
    [SUPERADMIN]: 'Super Admin',
    [ADMIN]: 'Admin',
    [USER]: 'User',
}

export const ROLE_HIERARCHY: Role[] = [USER, ADMIN, SUPERADMIN]

export const ROLE_OPTIONS = ROLE_HIERARCHY.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
}))
