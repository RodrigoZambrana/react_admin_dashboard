import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { resolveOptionalEnv } from '../common/config/runtime-env'
import { ROLES, type Role } from './roles.decorator'

const ADMIN_COMPATIBLE_ROLES: Role[] = [
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
  ROLES.OPS,
  ROLES.SALES,
  ROLES.FINANCE,
]

const DEFAULT_USER_MANAGEMENT_ROLES: Role[] = [ROLES.SUPERADMIN, ROLES.ADMIN]
const DEFAULT_CAPABILITY_MANAGEMENT_ROLES: Role[] = [ROLES.SUPERADMIN, ROLES.ADMIN]

const USER_MANAGEMENT_CONFIG_KEY = 'auth:userManagementAllowedRoles'
const USER_CAPABILITY_MANAGEMENT_CONFIG_KEY =
  'auth:userCapabilityManagementAllowedRoles'

type AuthUserLike =
  | {
      role?: string | null
      authority?: string[] | null
    }
  | null
  | undefined

type PolicySource = 'database' | 'environment'

type ResolvedRolePolicy = {
  roles: Role[]
  source: PolicySource
}

export type UserManagementPolicySnapshot = {
  canAccessUserManagement: boolean
  canManageUserCapabilities: boolean
  allowedUserManagementRoles: Role[]
  allowedCapabilityManagementRoles: Role[]
  userManagementPolicySource: PolicySource
  capabilityManagementPolicySource: PolicySource
}

const normalizeRoleList = (values: Iterable<string | null | undefined>) =>
  Array.from(
    new Set(
      Array.from(values)
        .map((value) => String(value || '').trim().toUpperCase())
        .filter((value): value is Role =>
          ADMIN_COMPATIBLE_ROLES.includes(value as Role),
        ),
    ),
  ) as Role[]

const parseRoleList = (raw: string | null | undefined): Role[] => {
  const normalized = String(raw || '').trim()
  if (!normalized) {
    return []
  }

  try {
    const parsed = JSON.parse(normalized)
    if (Array.isArray(parsed)) {
      return normalizeRoleList(parsed)
    }
  } catch {
    // fall through to comma-separated parsing
  }

  return normalizeRoleList(normalized.split(','))
}

const resolveActorRoles = (user: AuthUserLike): Role[] =>
  normalizeRoleList([
    ...(Array.isArray(user?.authority) ? user.authority : []),
    user?.role ?? null,
  ])

const parseConfiguredRoles = (
  envName: string,
  fallback: Role[],
): Role[] => {
  const configured = resolveOptionalEnv(envName)
  const parsed = parseRoleList(configured)
  return parsed.length ? parsed : fallback
}

@Injectable()
export class UserManagementPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveRolesFromConfig(
    key: string,
    envName: string,
    fallback: Role[],
  ): Promise<ResolvedRolePolicy> {
    const record = await this.prisma.systemConfig.findUnique({
      where: { key },
      select: { value: true },
    })

    const rolesFromDb = parseRoleList(record?.value)
    if (rolesFromDb.length) {
      return {
        roles: rolesFromDb,
        source: 'database',
      }
    }

    return {
      roles: parseConfiguredRoles(envName, fallback),
      source: 'environment',
    }
  }

  async getUserManagementAllowedRoles(): Promise<ResolvedRolePolicy> {
    return this.resolveRolesFromConfig(
      USER_MANAGEMENT_CONFIG_KEY,
      'USER_MANAGEMENT_ALLOWED_ROLES',
      DEFAULT_USER_MANAGEMENT_ROLES,
    )
  }

  async getUserCapabilityManagementAllowedRoles(): Promise<ResolvedRolePolicy> {
    return this.resolveRolesFromConfig(
      USER_CAPABILITY_MANAGEMENT_CONFIG_KEY,
      'USER_CAPABILITY_MANAGEMENT_ALLOWED_ROLES',
      DEFAULT_CAPABILITY_MANAGEMENT_ROLES,
    )
  }

  async canAccessUserManagement(user: AuthUserLike): Promise<boolean> {
    const actorRoles = resolveActorRoles(user)
    const allowedRoles = await this.getUserManagementAllowedRoles()
    return actorRoles.some((role) => allowedRoles.roles.includes(role))
  }

  async canManageUserCapabilities(user: AuthUserLike): Promise<boolean> {
    const actorRoles = resolveActorRoles(user)
    const allowedRoles = await this.getUserCapabilityManagementAllowedRoles()
    return actorRoles.some((role) => allowedRoles.roles.includes(role))
  }

  async getUserManagementPolicySnapshot(
    user: AuthUserLike,
  ): Promise<UserManagementPolicySnapshot> {
    const actorRoles = resolveActorRoles(user)
    const [userManagementRoles, capabilityManagementRoles] = await Promise.all([
      this.getUserManagementAllowedRoles(),
      this.getUserCapabilityManagementAllowedRoles(),
    ])

    return {
      canAccessUserManagement: actorRoles.some((role) =>
        userManagementRoles.roles.includes(role),
      ),
      canManageUserCapabilities: actorRoles.some((role) =>
        capabilityManagementRoles.roles.includes(role),
      ),
      allowedUserManagementRoles: userManagementRoles.roles,
      allowedCapabilityManagementRoles: capabilityManagementRoles.roles,
      userManagementPolicySource: userManagementRoles.source,
      capabilityManagementPolicySource: capabilityManagementRoles.source,
    }
  }

  async assertCanAccessUserManagement(user: AuthUserLike) {
    if (!(await this.canAccessUserManagement(user))) {
      throw new ForbiddenException('users.access.denied')
    }
  }

  async assertCanManageUserCapabilities(user: AuthUserLike) {
    if (!(await this.canManageUserCapabilities(user))) {
      throw new ForbiddenException('users.capabilities.denied')
    }
  }
}

