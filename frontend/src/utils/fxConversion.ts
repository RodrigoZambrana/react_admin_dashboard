import { normalizeCurrencyCode } from '@/utils/currency'

export type FxSnapshotLike = {
    base: string
    rates: Record<string, number | string | null | undefined>
}

const toNumericRate = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return undefined
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return undefined
    return numeric
}

export const convertAmountWithSnapshot = (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    snapshot?: FxSnapshotLike | null,
): number | undefined => {
    if (!snapshot || !Number.isFinite(amount)) {
        return undefined
    }
    const normalizedBase =
        normalizeCurrencyCode(snapshot.base, snapshot.base) || snapshot.base.toUpperCase()
    const normalize = (code?: string) =>
        normalizeCurrencyCode(code, normalizedBase) || (code ? code.toUpperCase() : undefined)

    const from = normalize(fromCurrency) || normalizedBase
    const to = normalize(toCurrency) || normalizedBase

    const rateFrom = from === normalizedBase ? 1 : toNumericRate(snapshot.rates[from])
    const rateTo = to === normalizedBase ? 1 : toNumericRate(snapshot.rates[to])

    if (!rateFrom || !rateTo) {
        return undefined
    }

    if (from === to) {
        return amount
    }

    const amountInBase = from === normalizedBase ? amount : amount * rateFrom
    return to === normalizedBase ? amountInBase : amountInBase / rateTo
}
