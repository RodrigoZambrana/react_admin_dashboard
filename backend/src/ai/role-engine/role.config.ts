import { ROLES, type Role } from '../../auth/roles.decorator'

export const AI_CONVERSATION_ROLES = [
  'customer_public',
  'customer_authenticated',
  'admin_support',
  'admin_sales',
  'admin_operations',
  'admin_supervisor',
  'superadmin',
] as const

export type AiConversationRole = (typeof AI_CONVERSATION_ROLES)[number]

export type AiRoleAudience = 'customer' | 'admin'

export type AiRoleTone =
  | 'helpful_public'
  | 'trusted_customer'
  | 'supportive_operator'
  | 'commercial_operator'
  | 'execution_operator'
  | 'supervisory_operator'
  | 'platform_owner'

export type AiRoleConfig = {
  key: AiConversationRole
  type: AiRoleAudience
  label: string
  memoryTurns: number
  allowedTools: string[]
  forbiddenIntents: string[]
  requiresConfirmation: string[]
  tone: AiRoleTone
  exposedFields: string[]
  legacyScopes: string[]
  authRoles: Role[]
}

const CUSTOMER_EXPOSED_FIELDS = [
  'role',
  'scope',
  'intentKey',
  'taskSummary',
  'needsHuman',
  'grounding',
]

const ADMIN_EXPOSED_FIELDS = [
  ...CUSTOMER_EXPOSED_FIELDS,
  'toolCalls',
  'blockedTools',
  'taskReset',
  'controlMode',
  'audit',
  'sources',
]

const ALL_TOOLS = [
  'search_products',
  'search_categories',
  'search_customers',
  'search_appointments',
  'search_orders',
  'search_quotes',
  'search_payments',
  'create_customer',
  'update_customer',
  'create_appointment',
  'update_appointment',
  'delete_appointment',
  'create_product',
  'update_product',
  'adjust_product_stock',
  'archive_product',
  'publish_product',
  'create_category',
  'update_category',
  'create_order',
  'create_quote',
  'create_payment',
  'update_order_status',
  'update_quote_status',
  'send_quote',
  'confirm_quote',
  'update_quote_comment',
  'update_order_comment',
  'update_quote_structure',
  'update_order_structure',
  'update_payment_status',
  'update_payment',
  'parse_aberturas',
  'prepare_aberturas_quote',
  'prepare_aberturas_insert',
] as const

const CUSTOMER_FORBIDDEN_INTENTS = [
  'customers.manage',
  'appointments.manage',
  'orders.manage',
  'quotes.manage',
  'payments.manage',
  'catalog.manage',
  'aberturas.register',
]

const CRITICAL_WRITE_TOOLS = [
  'create_customer',
  'update_customer',
  'create_appointment',
  'update_appointment',
  'delete_appointment',
  'create_product',
  'update_product',
  'adjust_product_stock',
  'archive_product',
  'publish_product',
  'create_category',
  'update_category',
  'create_order',
  'create_quote',
  'create_payment',
  'update_order_status',
  'update_quote_status',
  'send_quote',
  'confirm_quote',
  'update_quote_comment',
  'update_order_comment',
  'update_quote_structure',
  'update_order_structure',
  'update_payment_status',
  'update_payment',
  'prepare_aberturas_insert',
] as const

export const AI_ROLE_CONFIG: Record<AiConversationRole, AiRoleConfig> = {
  customer_public: {
    key: 'customer_public',
    type: 'customer',
    label: 'Cliente público',
    memoryTurns: 12,
    allowedTools: ['search_products'],
    forbiddenIntents: CUSTOMER_FORBIDDEN_INTENTS,
    requiresConfirmation: [],
    tone: 'helpful_public',
    exposedFields: CUSTOMER_EXPOSED_FIELDS,
    legacyScopes: ['customer_public'],
    authRoles: [],
  },
  customer_authenticated: {
    key: 'customer_authenticated',
    type: 'customer',
    label: 'Cliente autenticado',
    memoryTurns: 12,
    allowedTools: ['search_products'],
    forbiddenIntents: CUSTOMER_FORBIDDEN_INTENTS,
    requiresConfirmation: [],
    tone: 'trusted_customer',
    exposedFields: CUSTOMER_EXPOSED_FIELDS,
    legacyScopes: ['customer_authenticated', 'customer_logged', 'customer_logeado'],
    authRoles: [],
  },
  admin_support: {
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
    requiresConfirmation: [...CRITICAL_WRITE_TOOLS],
    tone: 'supportive_operator',
    exposedFields: ADMIN_EXPOSED_FIELDS,
    legacyScopes: ['admin_internal'],
    authRoles: [ROLES.ADMIN],
  },
  admin_sales: {
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
    requiresConfirmation: [...CRITICAL_WRITE_TOOLS],
    tone: 'commercial_operator',
    exposedFields: ADMIN_EXPOSED_FIELDS,
    legacyScopes: ['admin_internal'],
    authRoles: [ROLES.SALES],
  },
  admin_operations: {
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
      'create_product',
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
    requiresConfirmation: [...CRITICAL_WRITE_TOOLS],
    tone: 'execution_operator',
    exposedFields: ADMIN_EXPOSED_FIELDS,
    legacyScopes: ['admin_internal'],
    authRoles: [ROLES.OPS, ROLES.FINANCE],
  },
  admin_supervisor: {
    key: 'admin_supervisor',
    type: 'admin',
    label: 'Admin supervisor',
    memoryTurns: 10,
    allowedTools: [...ALL_TOOLS],
    forbiddenIntents: [],
    requiresConfirmation: [...CRITICAL_WRITE_TOOLS],
    tone: 'supervisory_operator',
    exposedFields: ADMIN_EXPOSED_FIELDS,
    legacyScopes: ['admin_internal'],
    authRoles: [ROLES.ADMIN, ROLES.FINANCE],
  },
  superadmin: {
    key: 'superadmin',
    type: 'admin',
    label: 'Superadmin',
    memoryTurns: 10,
    allowedTools: [...ALL_TOOLS],
    forbiddenIntents: [],
    requiresConfirmation: [...CRITICAL_WRITE_TOOLS],
    tone: 'platform_owner',
    exposedFields: [...ADMIN_EXPOSED_FIELDS, 'provider', 'model'],
    legacyScopes: ['admin_internal'],
    authRoles: [ROLES.SUPERADMIN],
  },
}

export const AI_ROLE_ALIASES: Record<string, AiConversationRole> = {
  customer_public: 'customer_public',
  customer_authenticated: 'customer_authenticated',
  customer_logged: 'customer_authenticated',
  customer_logeado: 'customer_authenticated',
  customer_logged_in: 'customer_authenticated',
  admin_internal: 'admin_support',
  admin_support: 'admin_support',
  admin_sales: 'admin_sales',
  admin_operations: 'admin_operations',
  admin_supervisor: 'admin_supervisor',
  superadmin: 'superadmin',
}

export const normalizeAiConversationRole = (
  value?: string | null,
): AiConversationRole | null => {
  if (!value) {
    return null
  }
  return AI_ROLE_ALIASES[String(value).trim().toLowerCase()] ?? null
}

export const getAiRoleConfig = (role: AiConversationRole) => AI_ROLE_CONFIG[role]

export const listAiRoleConfigs = () =>
  AI_CONVERSATION_ROLES.map((role) => AI_ROLE_CONFIG[role])
