import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemPrompt } from './system-prompt.js'

test('admin_internal prompt forces use of approved context before claiming missing information', () => {
  const prompt = buildSystemPrompt('admin_internal', {
    retrievalContext: [
      {
        title: 'Informe Analisis Datos UruCortinas',
        summary: 'Resumen ejecutivo del negocio',
        snippet: 'Lineas de negocio: roller, toldos y reparaciones.',
      },
    ],
    hasApprovedContext: true,
  })

  assert.match(prompt, /usalas primero para responder/i)
  assert.match(prompt, /citá al menos una fuente aprobada/i)
  assert.match(prompt, /no tenés acceso a documentos/i)
  assert.match(prompt, /Informe Analisis Datos UruCortinas/)
  assert.match(prompt, /solo podés responder que falta información suficiente después de agotar el contexto aprobado disponible/i)
})

test('admin_internal prompt enforces search-first and payload validation for operational actions', () => {
  const prompt = buildSystemPrompt('admin_internal', {
    actionCatalog: [
      {
        key: 'create_quote',
        toolName: 'create_quote',
        confirmationRequired: true,
        requiredFields: ['customerId', 'items'],
        supportedFields: ['customerId', 'currency', 'validForDays', 'items'],
        validationRules: [
          'Buscar primero el cliente si no hay customerId confirmado.',
          'No confirmar si faltan items o moneda.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá cliente, items, moneda y vigencia si aplica.',
      },
    ],
  })

  assert.match(prompt, /si existe una tool de búsqueda para la entidad/i)
  assert.match(prompt, /si la prebúsqueda ya devolvió coincidencias concretas/i)
  assert.match(prompt, /no pidas confirmación final si todavía hay campos faltantes/i)
  assert.match(prompt, /campos confirmados, campos faltantes y campos dudosos/i)
  assert.match(prompt, /Acción create_quote/i)
  assert.match(prompt, /Buscar primero el cliente si no hay customerId confirmado/i)
  assert.match(prompt, /No confirmar si faltan items o moneda/i)
})

test('admin_internal prompt anchors aberturas behavior to current live code contracts', () => {
  const prompt = buildSystemPrompt('admin_internal')

  assert.match(prompt, /servicio de pricing paramétrico/i)
  assert.match(prompt, /family_id, serie, material, color, vidrio, width_mm, height_mm/i)
  assert.match(prompt, /vidrio permitido por serie, monoblock permitido por serie, límites de ancho\/alto/i)
  assert.match(prompt, /no inventes precio ni disponibilidad final/i)
  assert.match(prompt, /solo aplican a conversaciones iniciadas por usuarios internos autenticados/i)
})

test('customer_public prompt blocks internal CRUD and admin-only workflows', () => {
  const prompt = buildSystemPrompt('customer_public')

  assert.match(prompt, /No podés ejecutar acciones administrativas internas/i)
  assert.match(prompt, /Nunca debes ofrecer ni simular ABM interno/i)
  assert.match(prompt, /un asesor del equipo lo ayudará a continuar/i)
  assert.match(prompt, /No pidas al cliente campos técnicos o administrativos propios de una operación interna/i)
})
