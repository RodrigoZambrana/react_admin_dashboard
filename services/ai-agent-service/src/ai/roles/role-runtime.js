const DEFAULT_ROLE_CATALOG = [
  {
    key: 'customer_public',
    type: 'customer',
    label: 'Cliente público',
    memoryTurns: 12,
    allowedTools: ['search_products'],
    forbiddenIntents: [
      'customers.manage',
      'appointments.manage',
      'orders.manage',
      'quotes.manage',
      'payments.manage',
      'catalog.manage',
      'aberturas.register',
    ],
    requiresConfirmation: [],
    tone: 'helpful_public',
    authRoles: [],
    legacyScopes: ['customer_public'],
  },
  {
    key: 'customer_authenticated',
    type: 'customer',
    label: 'Cliente autenticado',
    memoryTurns: 12,
    allowedTools: ['search_products'],
    forbiddenIntents: [
      'customers.manage',
      'appointments.manage',
      'orders.manage',
      'quotes.manage',
      'payments.manage',
      'catalog.manage',
      'aberturas.register',
    ],
    requiresConfirmation: [],
    tone: 'trusted_customer',
    authRoles: [],
    legacyScopes: ['customer_authenticated', 'customer_logged', 'customer_logeado'],
  },
  {
    key: 'admin_support',
    type: 'admin',
    label: 'Admin soporte',
    memoryTurns: 8,
    allowedTools: [
      'search_products',
      'search_customers',
      'search_appointments',
      'search_orders',
      'search_quotes',
      'search_payments',
      'create_appointment',
      'update_appointment',
      'delete_appointment',
      'update_customer',
    ],
    forbiddenIntents: ['catalog.manage', 'aberturas.register'],
    requiresConfirmation: [],
    tone: 'supportive_operator',
    authRoles: ['ADMIN'],
    legacyScopes: ['admin_internal'],
  },
  {
    key: 'admin_sales',
    type: 'admin',
    label: 'Admin ventas',
    memoryTurns: 8,
    allowedTools: [
      'search_products',
      'search_customers',
      'search_orders',
      'search_quotes',
      'search_categories',
      'create_customer',
      'update_customer',
      'create_quote',
      'update_quote_status',
      'send_quote',
      'confirm_quote',
      'update_quote_comment',
      'update_quote_structure',
      'prepare_aberturas_quote',
      'parse_aberturas',
    ],
    forbiddenIntents: ['payments.manage'],
    requiresConfirmation: [],
    tone: 'commercial_operator',
    authRoles: ['SALES'],
    legacyScopes: ['admin_internal'],
  },
  {
    key: 'admin_operations',
    type: 'admin',
    label: 'Admin operaciones',
    memoryTurns: 8,
    allowedTools: [
      'search_products',
      'search_customers',
      'search_appointments',
      'search_orders',
      'search_quotes',
      'search_payments',
      'search_categories',
      'update_customer',
      'create_appointment',
      'update_appointment',
      'delete_appointment',
      'update_product',
      'adjust_product_stock',
      'archive_product',
      'publish_product',
      'update_category',
      'create_order',
      'create_payment',
      'update_order_status',
      'update_order_comment',
      'update_order_structure',
      'update_payment_status',
      'update_payment',
      'parse_aberturas',
      'prepare_aberturas_quote',
      'prepare_aberturas_insert',
    ],
    forbiddenIntents: [],
    requiresConfirmation: [],
    tone: 'execution_operator',
    authRoles: ['OPS', 'FINANCE'],
    legacyScopes: ['admin_internal'],
  },
  {
    key: 'admin_supervisor',
    type: 'admin',
    label: 'Admin supervisor',
    memoryTurns: 10,
    allowedTools: ['*'],
    forbiddenIntents: [],
    requiresConfirmation: [],
    tone: 'supervisory_operator',
    authRoles: ['FINANCE', 'ADMIN'],
    legacyScopes: ['admin_internal'],
  },
  {
    key: 'superadmin',
    type: 'admin',
    label: 'Superadmin',
    memoryTurns: 10,
    allowedTools: ['*'],
    forbiddenIntents: [],
    requiresConfirmation: [],
    tone: 'platform_owner',
    authRoles: ['SUPERADMIN'],
    legacyScopes: ['admin_internal'],
  },
]

const ADMIN_ROLE_ORDER = [
  ['SUPERADMIN', 'superadmin'],
  ['SALES', 'admin_sales'],
  ['OPS', 'admin_operations'],
  ['FINANCE', 'admin_supervisor'],
  ['ADMIN', 'admin_support'],
]

const GROUP_ROLE_ORDER = [
  ['platform_admin', 'admin_supervisor'],
  ['sales', 'admin_sales'],
  ['operations', 'admin_operations'],
  ['finance', 'admin_supervisor'],
  ['support', 'admin_support'],
]

const FORBIDDEN_INTENT_FAMILY_RULES = [
  {
    family: 'customers.manage',
    matches: (intentKey) => String(intentKey || '').startsWith('customers.'),
  },
  {
    family: 'appointments.manage',
    matches: (intentKey) => String(intentKey || '').startsWith('appointments.'),
  },
  {
    family: 'orders.manage',
    matches: (intentKey) => String(intentKey || '').startsWith('orders.'),
  },
  {
    family: 'quotes.manage',
    matches: (intentKey) => String(intentKey || '').startsWith('quotes.'),
  },
  {
    family: 'payments.manage',
    matches: (intentKey) => String(intentKey || '').startsWith('payments.'),
  },
  {
    family: 'catalog.manage',
    matches: (intentKey) =>
      String(intentKey || '').startsWith('products.') ||
      String(intentKey || '').startsWith('categories.'),
  },
  {
    family: 'conversations.manage',
    matches: (intentKey) => String(intentKey || '').startsWith('conversations.'),
  },
]

const resolveCapabilityFamilies = (capabilityEnvelope = []) => {
  const families = new Set()

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

const normalizeStringList = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  )

export const getRoleCatalog = (roleCatalog) =>
  Array.isArray(roleCatalog) && roleCatalog.length ? roleCatalog : DEFAULT_ROLE_CATALOG

export const normalizeRole = (value, roleCatalog) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (!normalized) {
    return null
  }

  const catalog = getRoleCatalog(roleCatalog)
  const directMatch = catalog.find((entry) => entry.key === normalized)
  if (directMatch) {
    return directMatch.key
  }

  const legacyMatch = catalog.find((entry) =>
    Array.isArray(entry.legacyScopes) && entry.legacyScopes.includes(normalized),
  )
  return legacyMatch?.key ?? null
}

export const resolveRole = (payload, roleCatalog) => {
  const explicitRole = normalizeRole(payload?.role, roleCatalog)
  if (explicitRole) {
    return explicitRole
  }

  const authRoles = Array.isArray(payload?.authRoles)
    ? payload.authRoles
    : payload?.authRole
      ? [payload.authRole]
      : []
  const capabilityGroups = normalizeStringList(payload?.capabilityGroups)
  const capabilityEnvelope = normalizeStringList([
    ...(Array.isArray(payload?.capabilityEnvelope) ? payload.capabilityEnvelope : []),
    ...(Array.isArray(payload?.directCapabilities) ? payload.directCapabilities : []),
  ])

  if (authRoles.includes('SUPERADMIN')) {
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

  for (const [authRole, role] of ADMIN_ROLE_ORDER) {
    if (authRoles.includes(authRole)) {
      return role
    }
  }

  const scope = String(payload?.scope || '')
    .trim()
    .toLowerCase()
  if (
    payload?.authenticated === true ||
    scope === 'customer_authenticated' ||
    scope === 'customer_logged' ||
    scope === 'customer_logeado'
  ) {
    return 'customer_authenticated'
  }
  if (scope === 'admin_internal') {
    return 'admin_support'
  }
  return 'customer_public'
}

export const roleToScope = (role, roleCatalog) => {
  const config = getRoleConfig(role, roleCatalog)
  if (config?.type === 'admin') {
    return 'admin_internal'
  }
  return role === 'customer_authenticated'
    ? 'customer_authenticated'
    : 'customer_public'
}

export const getRoleConfig = (role, roleCatalog) =>
  getRoleCatalog(roleCatalog).find((entry) => entry.key === role) ??
  DEFAULT_ROLE_CATALOG[0]

export const canRoleUseTool = (role, toolName, roleCatalog) => {
  const config = getRoleConfig(role, roleCatalog)
  return (
    Array.isArray(config.allowedTools) &&
    (config.allowedTools.includes('*') || config.allowedTools.includes(toolName))
  )
}

export const roleRequiresConfirmation = (role, toolName, roleCatalog) => {
  const config = getRoleConfig(role, roleCatalog)
  return Array.isArray(config.requiresConfirmation) && config.requiresConfirmation.includes(toolName)
}

const resolveIntentGuardKeys = (intentKey) => {
  const normalizedIntent = String(intentKey || '')
    .trim()
    .toLowerCase()

  const guardKeys = new Set()
  if (!normalizedIntent) {
    return guardKeys
  }

  guardKeys.add(normalizedIntent)
  for (const rule of FORBIDDEN_INTENT_FAMILY_RULES) {
    if (rule.matches(normalizedIntent)) {
      guardKeys.add(rule.family)
    }
  }

  return guardKeys
}

export const canRoleExecuteIntent = (role, intentKey, roleCatalog) => {
  const config = getRoleConfig(role, roleCatalog)
  const normalizedForbidden = normalizeStringList(config.forbiddenIntents)
  const guardKeys = resolveIntentGuardKeys(intentKey)

  return !config.forbiddenIntents?.some(
    (entry) => {
      const normalizedEntry = String(entry || '')
        .trim()
        .toLowerCase()
      if (!normalizedEntry || !normalizedForbidden.includes(normalizedEntry)) {
        return false
      }

      return (
        guardKeys.has(normalizedEntry) ||
        String(intentKey || '').startsWith(`${normalizedEntry}.`)
      )
    },
  )
}

export const analyzeRoleResolution = (payload, roleCatalog) => {
  const explicitRole = normalizeRole(payload?.role, roleCatalog)
  if (explicitRole) {
    return { mode: 'explicit_role', ambiguous: false }
  }

  const authRoles = Array.isArray(payload?.authRoles)
    ? payload.authRoles
    : payload?.authRole
      ? [payload.authRole]
      : []
  const capabilityGroups = normalizeStringList(payload?.capabilityGroups)
  const capabilityEnvelope = normalizeStringList([
    ...(Array.isArray(payload?.capabilityEnvelope) ? payload.capabilityEnvelope : []),
    ...(Array.isArray(payload?.directCapabilities) ? payload.directCapabilities : []),
  ])

  if (authRoles.includes('SUPERADMIN')) {
    return { mode: 'superadmin', ambiguous: false }
  }

  if (capabilityGroups.length === 1) {
    const match = GROUP_ROLE_ORDER.find(([group]) => group === capabilityGroups[0])
    if (match) {
      return { mode: 'explicit_group', ambiguous: false }
    }
  }

  if (capabilityGroups.length > 1) {
    return { mode: 'explicit_groups_broad', ambiguous: true }
  }

  if (capabilityGroups.length === 0 && capabilityEnvelope.length > 0) {
    const families = resolveCapabilityFamilies(capabilityEnvelope)
    if (families.length === 1) {
      return { mode: 'explicit_capabilities', ambiguous: false }
    }
    if (families.length > 1) {
      return { mode: 'explicit_capabilities_broad', ambiguous: true }
    }
    return { mode: 'explicit_capabilities_unmapped', ambiguous: true }
  }

  for (const [authRole] of ADMIN_ROLE_ORDER) {
    if (authRoles.includes(authRole)) {
      return { mode: 'legacy_auth_role', ambiguous: false }
    }
  }

  const scope = String(payload?.scope || '')
    .trim()
    .toLowerCase()
  if (
    payload?.authenticated === true ||
    scope === 'customer_authenticated' ||
    scope === 'customer_logged' ||
    scope === 'customer_logeado'
  ) {
    return { mode: 'authenticated_customer', ambiguous: false }
  }

  return { mode: 'public_customer', ambiguous: false }
}
