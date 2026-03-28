import { NlpManager } from 'node-nlp'

const CUSTOMER_INTENT_TRAINING_SET = {
  greeting: [
    'hola',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'que tal',
  ],
  courtesy: [
    'gracias',
    'muchas gracias',
    'perfecto gracias',
    'genial gracias',
  ],
  generic_help_request: [
    'necesito informacion',
    'quiero saber',
    'tengo una consulta',
    'me ayudas',
    'necesito ayuda',
  ],
  product_inquiry: [
    'quiero saber sobre un producto',
    'que productos tienen',
    'me interesan varias opciones',
    'quiero consultar por un producto',
    'busco un modelo',
  ],
  price_inquiry: [
    'quiero un presupuesto',
    'cuanto sale',
    'que precio tiene',
    'necesito cotizar',
    'pasame el precio',
  ],
  payment_methods: [
    'que medios de pago aceptan',
    'aceptan tarjeta',
    'puedo pagar con transferencia',
    'hay cuotas',
  ],
  business_hours: [
    'cual es el horario',
    'que dias atienden',
    'a que hora abren',
    'a que hora cierran',
  ],
  location: [
    'donde estan',
    'cual es la direccion',
    'tienen local',
    'donde se ubican',
  ],
  contact_request: [
    'tienen telefono',
    'quiero hablar con alguien',
    'me pasas whatsapp',
    'como los contacto',
  ],
  delivery_shipping: [
    'hacen envios',
    'cuanto tarda la entrega',
    'llegan a mi zona',
    'cual es el costo de envio',
  ],
  stock_availability: [
    'hay stock',
    'tienen disponible',
    'queda disponible',
    'hay disponibilidad ahora',
  ],
  comparison: [
    'cual conviene mas',
    'cual es mejor',
    'que diferencia hay entre dos opciones',
    'quiero comparar opciones',
  ],
  appointment_booking: [
    'quiero agendar una visita',
    'podemos coordinar una cita',
    'quiero reservar una visita',
    'cuando pueden venir',
  ],
  order_status: [
    'como va mi pedido',
    'quiero saber el estado de la orden',
    'donde esta mi pedido',
    'se envio mi compra',
  ],
  support_request: [
    'no funciona',
    'tengo un problema',
    'necesito soporte',
    'quiero hacer un reclamo',
  ],
  frustration: [
    'esto no funciona nunca',
    'ya intente todo y no anda',
    'nadie me responde',
    'estoy molesto',
  ],
  clarification_request: [
    'no entiendo',
    'me lo explicas',
    'no me quedo claro',
    'podes repetir',
  ],
  out_of_scope: [
    'quien gano el partido',
    'como va el clima',
    'decime una receta',
    'hablame de politica',
  ],
}

let customerIntentManagerPromise = null

const buildCustomerIntentManager = async () => {
  const manager = new NlpManager({
    languages: ['es'],
    forceNER: false,
    autoSave: false,
    nlu: { log: false },
  })

  for (const [intent, utterances] of Object.entries(CUSTOMER_INTENT_TRAINING_SET)) {
    for (const utterance of utterances) {
      manager.addDocument('es', utterance, intent)
    }
  }

  await manager.train()
  return manager
}

const getCustomerIntentManager = async () => {
  if (!customerIntentManagerPromise) {
    customerIntentManagerPromise = buildCustomerIntentManager()
  }
  return customerIntentManagerPromise
}

export const detectCustomerBaseIntentWithNlp = async (input) => {
  const text = String(input || '').trim()
  if (!text) {
    return {
      intent: null,
      confidence: 0,
      alternatives: [],
      source: 'nlpjs',
    }
  }

  const manager = await getCustomerIntentManager()
  const result = await manager.process('es', text)
  const alternatives = Array.isArray(result?.classifications)
    ? result.classifications
        .filter((entry) => entry?.intent && entry.intent !== 'None')
        .map((entry) => ({
          intent: entry.intent,
          confidence:
            typeof entry.score === 'number' && Number.isFinite(entry.score)
              ? entry.score
              : 0,
        }))
    : []

  const topAlternative = alternatives[0] || null
  return {
    intent: topAlternative?.intent || null,
    confidence: topAlternative?.confidence || 0,
    alternatives,
    source: 'nlpjs',
  }
}
