export class MockProvider {
  constructor(config) {
    this.providerName = 'mock'
    this.modelName = config.modelName
  }

  async generate({ input, toolResults }) {
    if (toolResults?.length) {
      const products = toolResults[0]?.result ?? []
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
          toolCalls: toolResults.map((item) => ({
            name: item.name,
            arguments: item.arguments,
          })),
        }
      }
    }

    const normalized = input.trim().toLowerCase()
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
