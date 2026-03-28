import test from 'node:test'
import assert from 'node:assert/strict'
import {
  executeRegisteredActionStep,
  getActionDefinition,
  getActionExecutionDefinition,
  listConfirmableActions,
  listRegisteredActions,
  normalizeExecutionStep,
} from '../action-registry.js'

test('action registry resolves document actions with explicit execution contract', () => {
  const definition = getActionDefinition('quotes.confirm')

  assert.equal(definition?.draftBuilder, 'buildDocumentActionDraft')
  assert.equal(definition?.searchTool, 'search_quotes')
  assert.equal(definition?.executionTool, 'confirm_quote')
  assert.equal(definition?.verifyEntity, 'order')
  assert.equal(definition?.operationKind, 'confirm')
})

test('action registry lists registered confirmable actions', () => {
  const keys = listConfirmableActions().map((entry) => entry.key)

  assert.ok(keys.includes('customers.create'))
  assert.ok(keys.includes('products.create'))
  assert.ok(keys.includes('appointments.delete'))
})

test('action registry resolves explicit execution metadata for CRUD actions', () => {
  const execution = getActionExecutionDefinition('products.update')

  assert.equal(execution?.toolName, 'update_product')
  assert.equal(execution?.backendMethod, 'updateProduct')
  assert.equal(execution?.verifyEntity, 'product')
  assert.equal(execution?.verifyMode, 'detail')
  assert.equal(execution?.entityLabel, 'producto')
  assert.equal(execution?.requiresTargetId, true)
  assert.equal(execution?.resultShape, 'resource_updated')
})

test('action registry normalizes execution steps from tool names', () => {
  const normalized = normalizeExecutionStep({
    toolName: 'update_quote_status',
    targetId: 14,
    payload: { status: 'APPROVED' },
  })

  assert.equal(normalized?.backendMethod, 'updateQuoteStatus')
  assert.equal(normalized?.verifyEntity, 'quote')
  assert.equal(normalized?.verifyMode, 'detail')
  assert.equal(normalized?.entityLabel, 'presupuesto')
  assert.equal(normalized?.requiresTargetId, true)
  assert.equal(normalized?.resultShape, 'status_updated')
})

test('action registry executes registered backend methods without a switch table', async () => {
  const backendClient = {
    updatePaymentStatus: async (id, payload) => ({ id, ...payload }),
  }

  const execution = await executeRegisteredActionStep(
    {
      toolName: 'update_payment_status',
      targetId: 15,
      payload: { status: 'CONFIRMED' },
      successLabel: 'Pago confirmado',
    },
    backendClient,
  )

  assert.equal(execution.status, 'executed')
  assert.equal(execution.verifyEntity, 'payment')
  assert.equal(execution.verifyMode, 'detail')
  assert.equal(execution.resultShape, 'status_updated')
  assert.equal(execution.successLabel, 'Pago confirmado')
  assert.equal(execution.resultSummary?.label, 'Pago confirmado')
  assert.equal(execution.resultSummary?.summaryText, 'estado de pago actualizado')
  assert.equal(execution.resultSummary?.shouldVerify, true)
  assert.deepEqual(execution.result, {
    id: 15,
    status: 'CONFIRMED',
  })
})

test('action registry shapes deleted resources without verification links', async () => {
  const backendClient = {
    deleteAppointment: async (id) => ({ id }),
  }

  const execution = await executeRegisteredActionStep(
    {
      toolName: 'delete_appointment',
      targetId: 55,
      successLabel: 'Cita showroom',
    },
    backendClient,
  )

  assert.equal(execution.verifyMode, 'none')
  assert.equal(execution.resultSummary?.verifyEntity, null)
  assert.equal(execution.resultSummary?.shouldVerify, false)
  assert.equal(execution.resultSummary?.summaryText, 'cita eliminada')
})
