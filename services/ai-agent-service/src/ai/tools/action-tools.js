import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export function createSearchProductsTool(backendClient) {
  return tool(
    async ({ query, limit = 5 }) => {
      return backendClient.searchProducts(query, limit)
    },
    {
      name: 'search_products',
      description:
        'Busca productos reales del ecommerce en backend usando texto libre.',
      schema: z.object({
        query: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  )
}

const withConfirmation = (shape) =>
  z.object({
    confirmed: z.literal(true).describe(
      'Debe ser true solo si el usuario confirmó explícitamente la acción.',
    ),
    ...shape,
  })

export function createCustomerTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, ...payload }) => {
      return backendClient.createCustomer(payload)
    },
    {
      name: 'create_customer',
      description:
        'Crea o actualiza un cliente. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        name: z.string().min(2).max(160),
        firstName: z.string().max(80).optional(),
        lastName: z.string().max(80).optional(),
        email: z.string().email().optional(),
        phoneNumber: z.string().max(40).optional(),
        preferredLocale: z.string().max(16).optional(),
      }),
    },
  )
}

export function createAppointmentTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, ...payload }) => {
      return backendClient.createAppointment(payload)
    },
    {
      name: 'create_appointment',
      description:
        'Agenda una cita interna. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        title: z.string().min(2).max(160),
        description: z.string().optional(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime().optional(),
        type: z.enum(['MEETING', 'TASK', 'WORKSHOP', 'OTHER']).optional(),
        location: z.string().max(160).optional(),
        customerId: z.number().int().positive().optional(),
        projectId: z.number().int().positive().optional(),
        taskId: z.number().int().positive().optional(),
      }),
    },
  )
}

export function createProductTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, ...payload }) => {
      return backendClient.createProduct(payload)
    },
    {
      name: 'create_product',
      description:
        'Crea un producto. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        name: z.string().min(2).max(160),
        productCode: z.string().max(80).optional(),
        description: z.string().optional(),
        categoryId: z.number().int().positive().optional(),
        productType: z.enum(['PHYSICAL', 'SERVICE']).optional(),
        mode: z.enum(['SIMPLE', 'VARIABLE', 'PARAMETRIC']).optional(),
        salePrice: z.number().nonnegative().optional(),
        costPrice: z.number().nonnegative().optional(),
        currency: z.string().max(8).optional(),
        unitOfMeasure: z
          .enum(['UNIT', 'SQUARE_METER', 'LINEAR_METER'])
          .optional(),
        stock: z.number().int().optional(),
        published: z.boolean().optional(),
      }),
    },
  )
}

const orderItemSchema = z.object({
  productId: z.number().int().positive().optional(),
  name: z.string().min(1).max(160),
  price: z.number(),
  qty: z.number().int().positive(),
  description: z.string().optional(),
  comments: z.string().optional(),
})

export function createOrderTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, ...payload }) => {
      return backendClient.createOrder(payload)
    },
    {
      name: 'create_order',
      description:
        'Crea un pedido. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        customerId: z.number().int().positive(),
        currency: z.string().max(8).optional(),
        comment: z.string().optional(),
        shippingAddress1: z.string().optional(),
        shippingAddress2: z.string().optional(),
        shippingCity: z.string().optional(),
        shippingDepartment: z.string().optional(),
        shippingNeighborhood: z.string().optional(),
        shippingZip: z.string().optional(),
        shippingCountry: z.string().optional(),
        deliveryFees: z.number().nonnegative().optional(),
        items: z.array(orderItemSchema).min(1),
      }),
    },
  )
}

export function createQuoteTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, ...payload }) => {
      return backendClient.createQuote(payload)
    },
    {
      name: 'create_quote',
      description:
        'Genera un presupuesto. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        customerId: z.number().int().positive(),
        currency: z.string().max(8).optional(),
        comment: z.string().optional(),
        shippingAddress1: z.string().optional(),
        shippingAddress2: z.string().optional(),
        shippingCity: z.string().optional(),
        shippingDepartment: z.string().optional(),
        shippingNeighborhood: z.string().optional(),
        shippingZip: z.string().optional(),
        shippingCountry: z.string().optional(),
        deliveryFees: z.number().nonnegative().optional(),
        validForDays: z.number().int().positive().optional(),
        items: z.array(orderItemSchema).min(1),
      }),
    },
  )
}

export function createPaymentTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, ...payload }) => {
      return backendClient.createPayment(payload)
    },
    {
      name: 'create_payment',
      description:
        'Crea un pago para una orden. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        orderId: z.number().int().positive(),
        amount: z.number(),
        currency: z.string().max(8),
        type: z.enum(['DEPOSIT', 'BALANCE', 'REFUND']).optional(),
        status: z.enum(['REGISTERED', 'CONFIRMED', 'FAILED']).optional(),
        method: z.string().max(80).optional(),
        reference: z.string().max(120).optional(),
        notes: z.string().optional(),
      }),
    },
  )
}

export function getToolsForScope(scope, backendClient) {
  const sharedTools = [createSearchProductsTool(backendClient)]

  if (scope !== 'admin_internal') {
    return sharedTools
  }

  return [
    ...sharedTools,
    createCustomerTool(backendClient),
    createAppointmentTool(backendClient),
    createProductTool(backendClient),
    createOrderTool(backendClient),
    createQuoteTool(backendClient),
    createPaymentTool(backendClient),
  ]
}
