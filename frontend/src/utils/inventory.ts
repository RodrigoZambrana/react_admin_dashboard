export type InventoryStatus = 0 | 1 | 2

export const deriveInventoryStatus = (
    stock: number,
    permanentStock: boolean,
): InventoryStatus => {
    const normalizedStock = Number.isNaN(stock) ? 0 : stock
    if (permanentStock) {
        return 0
    }
    if (normalizedStock <= 0) {
        return 2
    }
    if (normalizedStock < 5) {
        return 1
    }
    return 0
}
