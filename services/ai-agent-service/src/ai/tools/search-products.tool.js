import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export function createSearchProductsTool(backendClient) {
  return tool(
    async ({ query }) => {
      return backendClient.searchProducts(query, 5)
    },
    {
      name: 'search_products',
      description:
        'Busca productos reales del ecommerce en backend usando texto libre.',
      schema: z.object({
        query: z.string().min(2).max(120),
      }),
    },
  )
}
