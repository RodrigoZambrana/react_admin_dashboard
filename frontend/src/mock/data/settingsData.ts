export const orderStatusesData = [
    { id: 0, name: 'Pagado', color: 'emerald-500' },
    { id: 1, name: 'Pendiente', color: 'amber-500' },
    { id: 2, name: 'Cancelado', color: 'red-500' },
]

export const customerStatusesData = [
    { id: 'active', name: 'Activo', color: 'emerald-500' },
    { id: 'blocked', name: 'Bloqueado', color: 'red-500' },
    { id: 'pending', name: 'Pendiente', color: 'amber-500' },
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
    { id: 'cash', name: 'Efectivo' },
    { id: 'card', name: 'Tarjeta' },
    { id: 'mp', name: 'Mercado Pago' },
]
