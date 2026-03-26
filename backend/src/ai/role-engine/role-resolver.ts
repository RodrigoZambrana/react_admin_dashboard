import type { Role } from '../../auth/roles.decorator'
import {
  normalizeCapabilityGroupList,
  normalizeCapabilityList,
} from '../../auth/capabilities'
import {
  type AiConversationRole,
  AI_ROLE_CONFIG,
  normalizeAiConversationRole,
} from './role.config'

type RoleResolverInput = {
  user?:
    | {
        role?: Role | null
        authority?: Role[] | null
        capabilityGroups?: string[] | null
        directCapabilities?: string[] | null
        capabilityEnvelope?: string[] | null
      }
    | null
  session?:
    | {
        authenticated?: boolean | null
        scope?: string | null
        role?: string | null
        capabilityGroups?: string[] | null
        directCapabilities?: string[] | null
        capabilityEnvelope?: string[] | null
      }
    | null
}

const ADMIN_ROLE_ORDER: Array<[Role, AiConversationRole]> = [
  ['SUPERADMIN', 'superadmin'],
  ['SALES', 'admin_sales'],
  ['OPS', 'admin_operations'],
  ['FINANCE', 'admin_supervisor'],
  ['ADMIN', 'admin_support'],
]

const GROUP_ROLE_ORDER: Array<[string, AiConversationRole]> = [
  ['platform_admin', 'admin_supervisor'],
  ['sales', 'admin_sales'],
  ['operations', 'admin_operations'],
  ['finance', 'admin_supervisor'],
  ['support', 'admin_support'],
]

const resolveCapabilityFamilies = (
  capabilityEnvelope: string[],
): AiConversationRole[] => {
  const families = new Set<AiConversationRole>()

  if (
    capabilityEnvelope.includes('aberturas.register') ||
    capabilityEnvelope.includes('catalog.manage') ||
    capabilityEnvelope.includes('payments.manage')
  ) {
    families.add('admin_operations')
  }

  if (
    capabilityEnvelope.includes('quotes.manage') ||
    capabilityEnvelope.includes('aberturas.quote')
  ) {
    families.add('admin_sales')
  }

  if (
    capabilityEnvelope.includes('customers.manage') ||
    capabilityEnvelope.includes('appointments.manage') ||
    capabilityEnvelope.includes('conversations.manage')
  ) {
    families.add('admin_support')
  }

  return Array.from(families)
}

export const resolveAiConversationRole = (
  input: RoleResolverInput,
): AiConversationRole => {
  const explicitRole = normalizeAiConversationRole(input.session?.role)
  if (explicitRole) {
    return explicitRole
  }

  const userRoles = [
    ...(input.user?.authority ?? []),
    ...(input.user?.role ? [input.user.role] : []),
  ]
  const capabilityGroups = normalizeCapabilityGroupList([
    ...(input.user?.capabilityGroups ?? []),
    ...(input.session?.capabilityGroups ?? []),
  ])
  const capabilityEnvelope = normalizeCapabilityList([
    ...(input.user?.capabilityEnvelope ?? []),
    ...(input.user?.directCapabilities ?? []),
    ...(input.session?.capabilityEnvelope ?? []),
    ...(input.session?.directCapabilities ?? []),
  ])

  if (userRoles.includes('SUPERADMIN')) {
    return 'superadmin'
  }

  if (capabilityGroups.length === 1) {
    const match = GROUP_ROLE_ORDER.find(([group]) => group === capabilityGroups[0])
    if (match) {
      return match[1]
    }
  }

  if (capabilityGroups.length === 0 && capabilityEnvelope.length > 0) {
    const families = resolveCapabilityFamilies(capabilityEnvelope)
    if (families.length === 1) {
      return families[0]
    }
  }

  for (const [role, aiRole] of ADMIN_ROLE_ORDER) {
    if (userRoles.includes(role)) {
      return aiRole
    }
  }

  if (input.session?.authenticated || input.session?.scope === 'customer_authenticated') {
    return 'customer_authenticated'
  }

  return 'customer_public'
}

export const resolveAiScopeFromRole = (
  role: AiConversationRole,
): 'customer_public' | 'customer_authenticated' | 'admin_internal' => {
  const config = AI_ROLE_CONFIG[role]
  if (config.type === 'admin') {
    return 'admin_internal'
  }
  return role === 'customer_authenticated'
    ? 'customer_authenticated'
    : 'customer_public'
}
