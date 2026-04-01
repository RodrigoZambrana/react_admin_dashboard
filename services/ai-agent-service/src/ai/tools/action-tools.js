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

export function createSearchCategoriesTool(backendClient) {
  return tool(
    async ({ query, limit = 5 }) => {
      return backendClient.searchCategories(query, limit)
    },
    {
      name: 'search_categories',
      description:
        'Busca categorías reales del ecommerce en backend usando texto libre.',
      schema: z.object({
        query: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  )
}

export function createSearchCustomersTool(backendClient) {
  return tool(
    async ({ query, limit = 5 }) => {
      return backendClient.searchCustomers(query, limit)
    },
    {
      name: 'search_customers',
      description:
        'Busca clientes reales en backend usando nombre, email o teléfono.',
      schema: z.object({
        query: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  )
}

export function createSearchAppointmentsTool(backendClient) {
  return tool(
    async ({ query, limit = 5 }) => {
      return backendClient.searchAppointments(query, limit)
    },
    {
      name: 'search_appointments',
      description:
        'Busca actividades o citas internas por texto libre.',
      schema: z.object({
        query: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  )
}

export function createSearchOrdersTool(backendClient) {
  return tool(
    async ({ query, limit = 5 }) => {
      return backendClient.searchOrders(query, limit, 'ORDER')
    },
    {
      name: 'search_orders',
      description:
        'Busca pedidos reales por cliente, UUID o comentario.',
      schema: z.object({
        query: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  )
}

export function createSearchQuotesTool(backendClient) {
  return tool(
    async ({ query, limit = 5 }) => {
      return backendClient.searchOrders(query, limit, 'BUDGET')
    },
    {
      name: 'search_quotes',
      description:
        'Busca presupuestos reales por cliente, UUID o comentario.',
      schema: z.object({
        query: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  )
}

export function createSearchPaymentsTool(backendClient) {
  return tool(
    async ({ query, limit = 5 }) => {
      return backendClient.searchPayments(query, limit)
    },
    {
      name: 'search_payments',
      description:
        'Busca pagos reales por cliente, pedido, referencia o método.',
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
        location: z.string().max(160).optional(),
        title: z.string().max(120).optional(),
        preferredLocale: z.string().max(16).optional(),
      }),
    },
  )
}

export function updateCustomerTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.updateCustomer(id, payload)
    },
    {
      name: 'update_customer',
      description:
        'Actualiza un cliente existente. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        name: z.string().min(2).max(160).optional(),
        firstName: z.string().max(80).optional(),
        lastName: z.string().max(80).optional(),
        email: z.string().email().optional(),
        phoneNumber: z.string().max(40).optional(),
        location: z.string().max(160).optional(),
        title: z.string().max(120).optional(),
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

export function updateAppointmentTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.updateAppointment(id, payload)
    },
    {
      name: 'update_appointment',
      description:
        'Actualiza una actividad o cita interna. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        title: z.string().min(2).max(160).optional(),
        description: z.string().optional(),
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
        type: z.enum(['MEETING', 'TASK', 'WORKSHOP', 'OTHER']).optional(),
        location: z.string().max(160).optional(),
      }),
    },
  )
}

export function deleteAppointmentTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id }) => {
      return backendClient.deleteAppointment(id)
    },
    {
      name: 'delete_appointment',
      description:
        'Elimina una actividad o cita interna. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
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

export function createCategoryTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, ...payload }) => {
      return backendClient.createCategory(payload)
    },
    {
      name: 'create_category',
      description:
        'Crea una categoría del ecommerce. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        name: z.string().min(2).max(160),
        description: z.string().optional(),
        parentId: z.number().int().positive().optional(),
      }),
    },
  )
}

export function updateCategoryTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.updateCategory(id, payload)
    },
    {
      name: 'update_category',
      description:
        'Actualiza una categoría del ecommerce. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        name: z.string().min(2).max(160).optional(),
        description: z.string().optional(),
        parentId: z.number().int().positive().optional(),
      }),
    },
  )
}

export function updateProductTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.updateProduct(id, payload)
    },
    {
      name: 'update_product',
      description:
        'Actualiza un producto existente. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        name: z.string().min(2).max(160).optional(),
        productCode: z.string().max(80).optional(),
        description: z.string().optional(),
        categoryId: z.number().int().positive().optional(),
        productType: z.enum(['PHYSICAL', 'SERVICE']).optional(),
        mode: z.enum(['SIMPLE', 'VARIABLE', 'PARAMETRIC']).optional(),
        salePrice: z.number().nonnegative().optional(),
        costPrice: z.number().nonnegative().optional(),
        currency: z.string().max(8).optional(),
        unitOfMeasure: z.enum(['UNIT', 'SQUARE_METER', 'LINEAR_METER']).optional(),
        stock: z.number().int().optional(),
        published: z.boolean().optional(),
      }),
    },
  )
}

export function adjustProductStockTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.adjustProductStock(id, payload)
    },
    {
      name: 'adjust_product_stock',
      description:
        'Ajusta el stock de un producto existente. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        delta: z.number().int().optional(),
        stock: z.number().int().optional(),
      }).refine(
        (value) =>
          (typeof value.delta === 'number' && typeof value.stock !== 'number') ||
          (typeof value.stock === 'number' && typeof value.delta !== 'number'),
        {
          message: 'Debes enviar delta o stock, pero no ambos.',
        },
      ),
    },
  )
}

export function archiveProductTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id }) => {
      return backendClient.archiveProduct(id)
    },
    {
      name: 'archive_product',
      description:
        'Despublica o archiva un producto. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
      }),
    },
  )
}

export function publishProductTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id }) => {
      return backendClient.publishProduct(id)
    },
    {
      name: 'publish_product',
      description:
        'Publica o reactiva un producto. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
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

const documentStructureUpdateSchema = {
  id: z.number().int().positive(),
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
  shippingVendor: z.string().max(160).optional(),
  estimatedMin: z.number().int().nonnegative().optional(),
  estimatedMax: z.number().int().nonnegative().optional(),
  validUntilDate: z.string().datetime().optional(),
  validForDays: z.number().int().positive().optional(),
  items: z.array(orderItemSchema).min(1).optional(),
  appendItems: z.array(orderItemSchema).min(1).optional(),
  removeItemNames: z.array(z.string().min(1).max(160)).min(1).optional(),
}

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

export function updateOrderStatusTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, status, force }) => {
      return backendClient.updateOrderStatus(id, { status, force })
    },
    {
      name: 'update_order_status',
      description:
        'Actualiza el estado de un pedido real. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        status: z.enum(['pending', 'paid', 'cancelled', 'delivered']),
        force: z.boolean().optional(),
      }),
    },
  )
}

export function updateOrderCommentTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, comment }) => {
      return backendClient.updateOrderComment(id, { comment })
    },
    {
      name: 'update_order_comment',
      description:
        'Actualiza la nota o comentario de un pedido real. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        comment: z.string().min(1).max(2000),
      }),
    },
  )
}

export function updateOrderStructureTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.updateOrderStructure(id, payload)
    },
    {
      name: 'update_order_structure',
      description:
        'Edita items y datos de envío de un pedido real. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation(documentStructureUpdateSchema),
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

export function sendQuoteTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id }) => {
      return backendClient.sendQuote(id)
    },
    {
      name: 'send_quote',
      description:
        'Marca un presupuesto como enviado usando el flujo real del sistema. Solo usar tras confirmación explícita.',
      schema: withConfirmation({
        id: z.number().int().positive(),
      }),
    },
  )
}

export function confirmQuoteTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id }) => {
      return backendClient.confirmQuote(id)
    },
    {
      name: 'confirm_quote',
      description:
        'Confirma o convierte un presupuesto a pedido usando el flujo real del sistema. Solo usar tras confirmación explícita.',
      schema: withConfirmation({
        id: z.number().int().positive(),
      }),
    },
  )
}

export function updateQuoteStatusTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, status, force }) => {
      return backendClient.updateQuoteStatus(id, { status, force })
    },
    {
      name: 'update_quote_status',
      description:
        'Actualiza el estado de un presupuesto real. Solo usar tras confirmación explícita.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        status: z.enum([
          'budget_draft',
          'budget_sent',
          'budget_accepted',
          'budget_converted',
          'budget_cancelled',
          'budget_expired',
        ]),
        force: z.boolean().optional(),
      }),
    },
  )
}

export function updateQuoteCommentTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, comment }) => {
      return backendClient.updateQuoteComment(id, { comment })
    },
    {
      name: 'update_quote_comment',
      description:
        'Actualiza la nota o comentario de un presupuesto real. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        comment: z.string().min(1).max(2000),
      }),
    },
  )
}

export function updateQuoteStructureTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.updateQuoteStructure(id, payload)
    },
    {
      name: 'update_quote_structure',
      description:
        'Edita items, envío y vigencia de un presupuesto real. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation(documentStructureUpdateSchema),
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

export function updatePaymentStatusTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, status }) => {
      return backendClient.updatePaymentStatus(id, { status })
    },
    {
      name: 'update_payment_status',
      description:
        'Actualiza el estado de un pago real. Solo usar tras confirmación explícita.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        status: z.enum(['REGISTERED', 'CONFIRMED', 'FAILED']),
      }),
    },
  )
}

export function updatePaymentTool(backendClient) {
  return tool(
    async ({ confirmed: _confirmed, id, ...payload }) => {
      return backendClient.updatePayment(id, payload)
    },
    {
      name: 'update_payment',
      description:
        'Actualiza datos operativos de un pago real. Solo usar tras confirmación explícita del usuario interno.',
      schema: withConfirmation({
        id: z.number().int().positive(),
        method: z.string().max(80).optional(),
        reference: z.string().max(120).optional(),
        notes: z.string().max(4000).optional(),
      }),
    },
  )
}

export function parseStructuredCatalogItemsTool(backendClient) {
  return tool(
    async ({ text, source, referenceDate }) => {
      return backendClient.parseStructuredCatalogItems({ text, source, referenceDate })
    },
    {
      name: 'parse_structured_catalog_items',
      description:
        'Parsea texto libre de ítems estructurados de catálogo y devuelve elementos listos para alta o cotización.',
      schema: z.object({
        text: z.string().min(4).max(12000),
        source: z.string().max(120).optional(),
        referenceDate: z.string().max(40).optional(),
      }),
    },
  )
}

export function prepareStructuredCatalogQuoteTool(backendClient) {
  return tool(
    async ({ text, source, referenceDate }) => {
      return backendClient.prepareStructuredCatalogQuote({ text, source, referenceDate })
    },
    {
      name: 'prepare_structured_catalog_quote',
      description:
        'Parsea ítems estructurados y arma un borrador listo para cotización o alta, usando pricing real cuando hay coincidencias.',
      schema: z.object({
        text: z.string().min(4).max(12000),
        source: z.string().max(120).optional(),
        referenceDate: z.string().max(40).optional(),
      }),
    },
  )
}

export function prepareStructuredCatalogInsertTool(backendClient) {
  return tool(
    async ({ text, source, referenceDate }) => {
      return backendClient.prepareStructuredCatalogInsert({ text, source, referenceDate })
    },
    {
      name: 'prepare_structured_catalog_insert',
      description:
        'Normaliza ítems estructurados para alta al sistema y devuelve payloads listos para inserción real, sin cotizar automáticamente.',
      schema: z.object({
        text: z.string().min(4).max(12000),
        source: z.string().max(120).optional(),
        referenceDate: z.string().max(40).optional(),
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
    createSearchCategoriesTool(backendClient),
    createSearchCustomersTool(backendClient),
    createSearchAppointmentsTool(backendClient),
    createSearchOrdersTool(backendClient),
    createSearchQuotesTool(backendClient),
    createSearchPaymentsTool(backendClient),
    createCustomerTool(backendClient),
    updateCustomerTool(backendClient),
    createAppointmentTool(backendClient),
    updateAppointmentTool(backendClient),
    deleteAppointmentTool(backendClient),
    createProductTool(backendClient),
    createCategoryTool(backendClient),
    updateCategoryTool(backendClient),
    updateProductTool(backendClient),
    adjustProductStockTool(backendClient),
    archiveProductTool(backendClient),
    publishProductTool(backendClient),
    createOrderTool(backendClient),
    updateOrderStatusTool(backendClient),
    updateOrderCommentTool(backendClient),
    updateOrderStructureTool(backendClient),
    createQuoteTool(backendClient),
    sendQuoteTool(backendClient),
    confirmQuoteTool(backendClient),
    updateQuoteStatusTool(backendClient),
    updateQuoteCommentTool(backendClient),
    updateQuoteStructureTool(backendClient),
    createPaymentTool(backendClient),
    updatePaymentStatusTool(backendClient),
    updatePaymentTool(backendClient),
    prepareStructuredCatalogInsertTool(backendClient),
    prepareStructuredCatalogQuoteTool(backendClient),
    parseStructuredCatalogItemsTool(backendClient),
  ]
}
