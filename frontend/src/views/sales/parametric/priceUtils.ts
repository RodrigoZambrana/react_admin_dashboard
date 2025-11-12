export const roundUpCurrency = (value: number, decimals = 2): number => {
    if (!Number.isFinite(value) || value <= 0) {
        return 0
    }
    const multiplier = 10 ** decimals
    return Math.ceil(value * multiplier - 1e-9) / multiplier
}

export const applyMarginToCost = (
    cost?: number | null,
    marginPercent?: number | null,
    options?: { roundDecimals?: number },
): number => {
    const numericCost = typeof cost === 'number' ? cost : 0
    if (!Number.isFinite(numericCost) || numericCost <= 0) {
        return 0
    }
    const normalizedCost = Math.round(numericCost * 100) / 100
    const factor = 1 + ((marginPercent ?? 0) || 0) / 100
    const saleRaw = normalizedCost * factor
    const decimals = options?.roundDecimals ?? 0
    return roundUpCurrency(saleRaw, decimals)
}
