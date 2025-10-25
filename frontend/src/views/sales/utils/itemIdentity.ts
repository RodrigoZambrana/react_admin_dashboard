export const createSalesItemLineId = (() => {
    let fallbackCounter = 0
    return (productId?: string) => {
        const prefix = productId ? `${productId}-` : ''
        const cryptoApi = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
        if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
            return `${prefix}${cryptoApi.randomUUID()}`
        }
        fallbackCounter += 1
        return `${prefix}line-${Date.now().toString(36)}-${fallbackCounter}`
    }
})()
