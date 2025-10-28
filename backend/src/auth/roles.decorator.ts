import { SetMetadata } from '@nestjs/common'

export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  OPS: 'OPS',
  SALES: 'SALES',
  FINANCE: 'FINANCE',
  USER: 'USER',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLES_KEY = 'roles'

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
