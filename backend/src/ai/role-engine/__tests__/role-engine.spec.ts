import { describe, expect, it } from 'vitest'
import {
  canExecuteIntent,
  canExposeField,
  canUseTool,
  requiresConfirmationForTool,
  resolveAiConversationRole,
  resolveAiScopeFromRole,
  shouldResetContext,
} from '..'

describe('AI role engine', () => {
  it('resolves customer roles from session state', () => {
    expect(
      resolveAiConversationRole({
        session: { authenticated: false },
      }),
    ).toBe('customer_public')

    expect(
      resolveAiConversationRole({
        session: { authenticated: true },
      }),
    ).toBe('customer_authenticated')
  })

  it('maps internal auth roles to explicit conversation roles', () => {
    expect(
      resolveAiConversationRole({
        user: { role: 'SALES' },
      }),
    ).toBe('admin_sales')

    expect(
      resolveAiConversationRole({
        user: { role: 'OPS' },
      }),
    ).toBe('admin_operations')

    expect(
      resolveAiConversationRole({
        user: { role: 'SUPERADMIN' },
      }),
    ).toBe('superadmin')
  })

  it('uses explicit capability groups when they clearly define the admin profile', () => {
    expect(
      resolveAiConversationRole({
        user: {
          role: 'ADMIN',
          capabilityGroups: ['sales'],
        },
      }),
    ).toBe('admin_sales')

    expect(
      resolveAiConversationRole({
        user: {
          role: 'ADMIN',
          capabilityGroups: ['operations'],
        },
      }),
    ).toBe('admin_operations')
  })

  it('enforces tool usage and confirmations by role', () => {
    expect(canUseTool('customer_public', 'create_order')).toBe(false)
    expect(canUseTool('admin_sales', 'create_quote')).toBe(true)
    expect(canUseTool('admin_support', 'prepare_aberturas_insert')).toBe(false)
    expect(requiresConfirmationForTool('admin_sales', 'create_quote')).toBe(true)
  })

  it('blocks forbidden intents for customer roles and preserves field secrecy', () => {
    expect(canExecuteIntent('customer_public', 'aberturas.register')).toBe(false)
    expect(canExecuteIntent('customer_authenticated', 'payments.manage')).toBe(false)
    expect(canExposeField('customer_public', 'toolCalls')).toBe(false)
    expect(canExposeField('superadmin', 'model')).toBe(true)
    expect(canExposeField('superadmin', 'openAiApiKey')).toBe(false)
  })

  it('resets context more aggressively for admin roles', () => {
    expect(
      shouldResetContext('admin_support', {
        changed: true,
        previousIntentKey: 'customers.manage',
        currentIntentKey: 'orders.manage',
        overlap: 0.9,
      }),
    ).toBe(true)

    expect(
      shouldResetContext('customer_authenticated', {
        changed: true,
        previousIntentKey: 'customer.quote',
        currentIntentKey: 'customer.support_request',
        overlap: 0.4,
      }),
    ).toBe(false)
  })

  it('maps explicit roles back to legacy scopes for compatibility', () => {
    expect(resolveAiScopeFromRole('admin_support')).toBe('admin_internal')
    expect(resolveAiScopeFromRole('customer_authenticated')).toBe(
      'customer_authenticated',
    )
  })
})
