import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretMessageElements } from '../interpret-message-elements.js'
import { buildMessageContext } from '../build-message-context.js'

test('interpretMessageElements builds multimodal elements from text and extracted assets', () => {
  const elements = interpretMessageElements({
    text: 'Necesito cargar esto al sistema',
    extractedAssets: [
      {
        assetType: 'image',
        fileName: 'abertura.png',
        normalizedText:
          'Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234',
      },
      {
        assetType: 'csv',
        fileName: 'productos.csv',
        structuredRows: [
          { nombre: 'Roller Screen', precio: '500', moneda: 'UYU' },
          { nombre: 'Roller Blackout', precio: '800', moneda: 'UYU' },
        ],
      },
    ],
  })

  assert.equal(elements[0]?.kind, 'text')
  assert.equal(elements[1]?.kind, 'image')
  assert.equal(elements[2]?.kind, 'table')

  const context = buildMessageContext(elements, 'Necesito cargar esto al sistema')
  assert.equal(context.usedElementCount, 2)
  assert.match(context.effectiveInput, /Contexto extra[ií]do desde elementos del mensaje/i)
  assert.match(context.effectiveInput, /Corrediza 2h2g serie probba blanco/i)
  assert.match(context.effectiveInput, /Roller Screen/i)
})

test('interpretMessageElements falls back to attachments when no extracted assets exist', () => {
  const elements = interpretMessageElements({
    text: 'Revisa el audio',
    attachments: [
      {
        assetType: 'audio',
        fileName: 'nota.webm',
        textContent: 'Necesito agendar una visita para mañana.',
      },
    ],
  })

  assert.equal(elements.length, 2)
  assert.equal(elements[1]?.kind, 'audio')

  const context = buildMessageContext(elements, 'Revisa el audio')
  assert.match(context.effectiveInput, /Necesito agendar una visita para mañana/i)
})

test('interpretMessageElements preserves all supported chat element kinds for downstream audit and context', () => {
  const elements = interpretMessageElements({
    text: 'Analiza todo el material adjunto y ayúdame a seguir.',
    attachments: [
      {
        assetType: 'image',
        fileName: 'fachada.jpg',
        textContent: 'Frente con abertura corrediza gris.',
      },
      {
        assetType: 'audio',
        fileName: 'nota.webm',
        textContent: 'Necesito una visita esta semana.',
      },
      {
        assetType: 'pdf',
        fileName: 'detalle.pdf',
        textContent: 'Documento con medidas y observaciones.',
      },
      {
        assetType: 'csv',
        fileName: 'items.csv',
        textContent: 'producto,precio\nroller blackout,500',
      },
    ],
  })

  assert.deepEqual(
    elements.map((element) => element.kind),
    ['text', 'image', 'audio', 'document', 'table'],
  )

  const context = buildMessageContext(elements, 'Analiza todo el material adjunto y ayúdame a seguir.')
  assert.equal(context.usedElementCount, 3)
  assert.ok(context.usedElementKinds.includes('image'))
  assert.ok(context.usedElementKinds.includes('audio'))
  assert.ok(context.usedElementKinds.includes('document'))
  assert.ok(!context.usedElementKinds.includes('table'))
})
