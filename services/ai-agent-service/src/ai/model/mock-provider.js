const shouldSearchProducts = (input) =>
  [
    'producto',
    'cortina',
    'roller',
    'persiana',
    'mosquitero',
    'abertura',
    'precio',
    'catálogo',
  ].some((token) => input.includes(token))

const hasExplicitConfirmation = (input) =>
  ['confirmo', 'confirmar', 'autorizo', 'procedé', 'procede', 'adelante']
    .some((token) => input.includes(token))

const findActionIntent = (input, actionCatalog = []) =>
  actionCatalog.find((entry) =>
    (entry.keywords || []).some((token) => input.includes(token.toLowerCase())),
  ) ?? null

export class MockProvider {
  constructor(config) {
    this.providerName = 'mock'
    this.modelName = config.modelName
  }

  async generate({
    input,
    tools = [],
    role = 'customer_public',
    actionCatalog = [],
    retrievalContext = [],
  }) {
    const normalized = input.trim().toLowerCase()
    let executedToolCalls = []

    if (String(role).startsWith('admin_') || role === 'superadmin') {
      const actionIntent = findActionIntent(normalized, actionCatalog)
      if (actionIntent && !hasExplicitConfirmation(normalized)) {
        const requiredFields = Array.isArray(actionIntent.requiredFields)
          ? actionIntent.requiredFields.join(', ')
          : 'datos finales'
        return {
          text: [
            `Puedo ayudarte con esa acción (${actionIntent.label}), pero antes necesito confirmación explícita.`,
            actionIntent.confirmationPrompt ||
              'Necesito una confirmación clara antes de ejecutar la acción.',
            `Campos mínimos a validar: ${requiredFields}.`,
            'Cuando quieras ejecutarla, respondé con los datos finales y una frase explícita como "confirmo".',
          ].join(' '),
          toolCalls: [],
        }
      }

      if (actionIntent && hasExplicitConfirmation(normalized)) {
        return {
          text: [
            `Tengo confirmación para ${actionIntent.label}.`,
            actionIntent.confirmationPrompt ||
              'Voy a ejecutar la acción con los datos estructurados disponibles.',
            'Si todavía falta algún campo obligatorio, pasámelo en el próximo mensaje y ejecuto la tool correspondiente.',
          ].join(' '),
          toolCalls: [],
        }
      }
    }

    if (shouldSearchProducts(normalized)) {
      const searchTool = tools.find((tool) => tool.name === 'search_products')
      if (searchTool) {
        const result = await searchTool.invoke({ query: input, limit: 5 })
        executedToolCalls = [
          {
            name: 'search_products',
            arguments: { query: input, limit: 5 },
            result,
            status: 'executed',
          },
        ]
      }
    }

    if (executedToolCalls?.length) {
      const products = executedToolCalls[0]?.result ?? []
      if (products.length) {
        const lines = products
          .slice(0, 3)
          .map((product) => {
            const amount =
              product.amount != null && product.currency
                ? `${product.currency} ${product.amount}`
                : 'precio a confirmar'
            return `- ${product.name} (${amount})`
          })
        return {
          text: `Encontré estas opciones relacionadas:\n${lines.join('\n')}`,
          toolCalls: executedToolCalls.map((item) => ({
            name: item.name,
            arguments: item.arguments,
            result: item.result,
            status: item.status,
          })),
        }
      }
    }

    if (normalized.includes('presupuesto')) {
      return {
        text: 'Puedo ayudarte a preparar un presupuesto. Necesito el producto, medidas y cualquier detalle adicional para avanzar.',
      }
    }

    if (retrievalContext?.length) {
      const lines = retrievalContext.slice(0, 3).map((entry) => {
        const snippet = entry.summary || entry.snippet || 'Sin resumen'
        return `- ${entry.title}: ${snippet}`
      })
      return {
        text: `Encontré conocimiento aprobado relacionado:\n${lines.join('\n')}`,
        toolCalls: [],
      }
    }

    return {
      text: 'Recibí tu consulta. Puedo ayudarte con productos, cotizaciones y seguimiento si me das más detalle.',
    }
  }

  async extractStructured() {
    return null
  }
}
