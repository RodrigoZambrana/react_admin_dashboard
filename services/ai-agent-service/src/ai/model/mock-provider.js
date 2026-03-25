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

export class MockProvider {
  constructor(config) {
    this.providerName = 'mock'
    this.modelName = config.modelName
  }

  async generate({ input, tools = [] }) {
    const normalized = input.trim().toLowerCase()
    let executedToolCalls = []

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

    return {
      text: 'Recibí tu consulta. Puedo ayudarte con productos, cotizaciones y seguimiento si me das más detalle.',
    }
  }
}
