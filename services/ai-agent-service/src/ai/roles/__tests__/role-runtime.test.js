import test from 'node:test'
import assert from 'node:assert/strict'
import { canRoleExecuteIntent } from '../role-runtime.js'

const roleCatalog = [
  {
    key: 'customer_public',
    type: 'customer',
    allowedTools: ['search_products'],
    forbiddenIntents: ['catalog.manage', 'orders.manage', 'aberturas.register'],
    requiresConfirmation: [],
  },
  {
    key: 'admin_sales',
    type: 'admin',
    allowedTools: ['search_products', 'create_quote'],
    forbiddenIntents: ['payments.manage'],
    requiresConfirmation: [],
  },
]

test('canRoleExecuteIntent blocks concrete catalog intents through forbidden family mapping', () => {
  assert.equal(
    canRoleExecuteIntent('customer_public', 'products.create', roleCatalog),
    false,
  )
  assert.equal(
    canRoleExecuteIntent('customer_public', 'categories.update', roleCatalog),
    false,
  )
})

test('canRoleExecuteIntent blocks payment mutations through payments.manage family', () => {
  assert.equal(
    canRoleExecuteIntent('admin_sales', 'payments.update_status', roleCatalog),
    false,
  )
  assert.equal(
    canRoleExecuteIntent('admin_sales', 'payments.create', roleCatalog),
    false,
  )
})
