export const orderStatusesData = [
    {
        id: 100,
        code: 'pending',
        label: 'Pending',
        color: 'orange',
        translations: { es: 'Pendiente', en: 'Pending' },
        documentTypes: ['ORDER'],
        isDefault: true,
        isTerminal: false,
    },
    {
        id: 200,
        code: 'paid',
        label: 'Paid',
        color: 'green',
        translations: { es: 'Pagado', en: 'Paid' },
        documentTypes: ['ORDER'],
        isDefault: false,
        isTerminal: false,
    },
    {
        id: 300,
        code: 'cancelled',
        label: 'Cancelled',
        color: 'red',
        translations: { es: 'Cancelado', en: 'Cancelled' },
        documentTypes: ['ORDER'],
        isDefault: false,
        isTerminal: true,
    },
    {
        id: 400,
        code: 'delivered',
        label: 'Delivered',
        color: 'green',
        translations: { es: 'Entregado', en: 'Delivered' },
        documentTypes: ['ORDER'],
        isDefault: false,
        isTerminal: true,
    },
    {
        id: 1000,
        code: 'budget_draft',
        label: 'Quote - Draft',
        color: '#9ca3af',
        translations: { es: 'Presupuesto - Borrador', en: 'Quote - Draft' },
        documentTypes: ['BUDGET'],
        isDefault: true,
        isTerminal: false,
    },
    {
        id: 1010,
        code: 'budget_sent',
        label: 'Quote - Sent',
        color: '#3b82f6',
        translations: { es: 'Presupuesto - Enviado', en: 'Quote - Sent' },
        documentTypes: ['BUDGET'],
        isDefault: false,
        isTerminal: false,
    },
    {
        id: 1020,
        code: 'budget_accepted',
        label: 'Quote - Accepted',
        color: '#10b981',
        translations: { es: 'Presupuesto - Aceptado', en: 'Quote - Accepted' },
        documentTypes: ['BUDGET'],
        isDefault: false,
        isTerminal: false,
    },
    {
        id: 1050,
        code: 'budget_expired',
        label: 'Quote - Expired',
        color: '#f97316',
        translations: { es: 'Presupuesto - Expirado', en: 'Quote - Expired' },
        documentTypes: ['BUDGET'],
        isDefault: false,
        isTerminal: true,
    },
]

export const expenseStatusesData = [
    { id: 0, name: 'Pagado', color: 'emerald-500' },
    { id: 1, name: 'Pendiente', color: 'amber-500' },
    { id: 2, name: 'Cancelado', color: 'red-500' },
]

export const productCategoriesData = [
    { id: 1, name: 'Dispositivos', description: 'Tecnología y electrónica', image: null, parentId: null },
    { id: 2, name: 'Smartphones', description: null, image: null, parentId: 1 },
    { id: 3, name: 'Accesorios', description: null, image: null, parentId: 1 },
    { id: 4, name: 'Bolsos', description: null, image: null, parentId: null },
    { id: 5, name: 'Zapatos', description: null, image: null, parentId: null },
]

export const paymentMethodsData = [
    {
        id: 1,
        code: 'mercado_pago',
        label: 'Mercado Pago',
        translations: { es: 'Mercado Pago', en: 'Mercado Pago' },
    },
    {
        id: 2,
        code: 'cash',
        label: 'Efectivo',
        translations: { es: 'Efectivo', en: 'Cash' },
    },
]

export const emailTemplatesData = [
    {
        id: 1,
        category: 'ORDERS',
        variant: 'CUSTOMER',
        locale: 'en',
        version: 2,
        subject: '[Acme] Your order #{{payload.orderNumber}}',
        body: '<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{payload.customer.name}}, this is a mock template preview.</mj-text></mj-column></mj-section></mj-body></mjml>',
        active: true,
        updatedAt: '2024-04-01T12:00:00Z',
    },
    {
        id: 2,
        category: 'ORDERS',
        variant: 'ADMIN',
        locale: 'es',
        version: 2,
        subject: '[Pedidos] Nuevo pedido #{{payload.orderNumber}}',
        body: '<mjml><mj-body><mj-section><mj-column><mj-text>Este es un ejemplo de plantilla administrativa.</mj-text></mj-column></mj-section></mj-body></mjml>',
        active: true,
        updatedAt: '2024-04-02T08:30:00Z',
    },
    {
        id: 3,
        category: 'PAYMENTS',
        variant: 'CUSTOMER',
        locale: 'en',
        version: 1,
        subject: '[Acme] Payment received for order #{{payload.orderNumber}}',
        body: '<mjml><mj-body><mj-section><mj-column><mj-text>Payment confirmation preview.</mj-text></mj-column></mj-section></mj-body></mjml>',
        active: true,
        updatedAt: '2024-04-05T09:45:00Z',
    },
]

export const emailMetricsData = {
    totals: { attempts: 6, sent: 5, failed: 1 },
    perCategory: {
        ORDERS: { attempts: 4, sent: 3, failed: 1 },
        PAYMENTS: { attempts: 2, sent: 2, failed: 0 },
    },
    perTemplate: {
        'ORDERS:CUSTOMER:1': { attempts: 2, sent: 1, failed: 1 },
        'ORDERS:ADMIN:2': { attempts: 2, sent: 2, failed: 0 },
        'PAYMENTS:CUSTOMER:3': { attempts: 2, sent: 2, failed: 0 },
    },
}
