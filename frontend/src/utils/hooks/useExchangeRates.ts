import { useCallback, useEffect, useMemo } from 'react'
import { apiGetSystemConfig } from '@/services/SettingsService'
import { useAppDispatch, useAppSelector } from '@/store'
import {
    setAvailableCurrencies,
    setExchangeError,
    setExchangeLoading,
    setExchangeSnapshot,
    type BaseCurrencySnapshot,
    type CurrencyCode,
    type CurrencyOption,
} from '@/store/slices/currency/currencySlice'
import {
    createExchangeSnapshot,
    ensureCurrencyPresence,
    type SystemConfigExchangePayload,
} from '@/utils/exchange'
import { normalizeCurrencyCode } from '@/utils/currency'

type ConversionResult = {
    value: number
    missingRates: CurrencyCode[]
    snapshot: BaseCurrencySnapshot
}

type ConvertOptions = {
    snapshot?: BaseCurrencySnapshot
}

export type UseExchangeRatesOptions = {
    autoRefresh?: boolean
    fallbackBase?: CurrencyCode
    fallbackCurrencies?: CurrencyCode[]
    fallbackOptions?: CurrencyOption[]
}

const createFallbackOptions = (
    currencies: CurrencyCode[],
    provided?: CurrencyOption[],
): CurrencyOption[] => {
    if (provided && provided.length) {
        return provided
    }
    return currencies.map((code) => ({
        value: code,
        label: code,
    }))
}

export const useExchangeRates = (options: UseExchangeRatesOptions = {}) => {
    const dispatch = useAppDispatch()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const availableCurrencies = useAppSelector((state) => state.currency.available)
    const storedSnapshot = useAppSelector((state) => state.currency.exchangeSnapshot)
    const exchangeLoading = useAppSelector((state) => state.currency.exchangeLoading)

    const snapshotOptions = useMemo(() => {
        const fallbackBase =
            options.fallbackBase ||
            normalizeCurrencyCode(storeCurrency, storeCurrency) ||
            (storeCurrency as CurrencyCode)
        const fallbackCurrencies = ensureCurrencyPresence(
            options.fallbackCurrencies && options.fallbackCurrencies.length
                ? options.fallbackCurrencies
                : availableCurrencies,
            fallbackBase,
        )
        const fallbackOptions = createFallbackOptions(
            fallbackCurrencies,
            options.fallbackOptions,
        )
        return {
            fallbackBase,
            fallbackCurrencies,
            fallbackOptions,
        }
    }, [availableCurrencies, options.fallbackBase, options.fallbackCurrencies, options.fallbackOptions, storeCurrency])

    const fallbackSnapshot = useMemo(
        () => createExchangeSnapshot(undefined, snapshotOptions),
        [snapshotOptions],
    )

    const activeSnapshot = storedSnapshot ?? fallbackSnapshot

    const refresh = useCallback(async () => {
        dispatch(setExchangeLoading(true))
        try {
            const response = await apiGetSystemConfig<SystemConfigExchangePayload>()
            const snapshot = createExchangeSnapshot(response.data, snapshotOptions)
            dispatch(setExchangeSnapshot(snapshot))
            if (Array.isArray(response.data?.currencies)) {
                const ensured = ensureCurrencyPresence(response.data.currencies, snapshot.base)
                dispatch(setAvailableCurrencies(ensured))
            }
            const numericTax = Number(response.data?.taxRate)
            return { snapshot, payload: response.data, taxRate: numericTax }
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                'Unable to load exchange rates.'
            dispatch(setExchangeError(message))
            throw error
        }
    }, [dispatch, snapshotOptions])

    const ensureSnapshot = useCallback(async () => {
        if (storedSnapshot) {
            return storedSnapshot
        }
        try {
            const result = await refresh()
            return result.snapshot
        } catch {
            return fallbackSnapshot
        }
    }, [fallbackSnapshot, refresh, storedSnapshot])

    const convertInternal = useCallback(
        (
            amount: number,
            fromCurrency?: string | null,
            toCurrency?: string | null,
            opts: ConvertOptions = {},
        ): ConversionResult => {
            const snapshot = opts.snapshot ?? activeSnapshot
            if (!Number.isFinite(amount)) {
                return {
                    value: Number.NaN,
                    missingRates: [],
                    snapshot,
                }
            }
            const normalizedFrom =
                normalizeCurrencyCode(fromCurrency, snapshot.base) || snapshot.base
            const normalizedTo =
                normalizeCurrencyCode(toCurrency, snapshot.base) || snapshot.base

            const missingRates: CurrencyCode[] = []
            let amountInBase = amount

            if (normalizedFrom !== snapshot.base) {
                const rateFrom = snapshot.rates[normalizedFrom]
                if (!Number.isFinite(rateFrom) || rateFrom <= 0) {
                    missingRates.push(normalizedFrom)
                } else {
                    amountInBase = amount * rateFrom
                }
            }

            let converted = amountInBase
            if (normalizedTo !== snapshot.base) {
                const rateTo = snapshot.rates[normalizedTo]
                if (!Number.isFinite(rateTo) || rateTo <= 0) {
                    missingRates.push(normalizedTo)
                } else {
                    converted = amountInBase / rateTo
                }
            }

            return {
                value: missingRates.length ? Number.NaN : converted,
                missingRates,
                snapshot,
            }
        },
        [activeSnapshot],
    )

    const convert = useCallback(
        (
            amount: number,
            fromCurrency?: string | null,
            toCurrency?: string | null,
            opts?: ConvertOptions,
        ) => convertInternal(amount, fromCurrency, toCurrency, opts),
        [convertInternal],
    )

    const convertToBase = useCallback(
        (amount: number, fromCurrency?: string | null, opts?: ConvertOptions) =>
            convertInternal(amount, fromCurrency, activeSnapshot.base, opts),
        [activeSnapshot.base, convertInternal],
    )

    const convertFromBase = useCallback(
        (amount: number, toCurrency?: string | null, opts?: ConvertOptions) =>
            convertInternal(amount, activeSnapshot.base, toCurrency, opts),
        [activeSnapshot.base, convertInternal],
    )

    useEffect(() => {
        if (options.autoRefresh && !storedSnapshot && !exchangeLoading) {
            refresh().catch(() => {
                /* handled via state */
            })
        }
    }, [exchangeLoading, options.autoRefresh, refresh, storedSnapshot])

    return {
        snapshot: activeSnapshot,
        loading: exchangeLoading,
        refresh,
        ensureSnapshot,
        convert,
        convertToBase,
        convertFromBase,
    }
}

export type UseExchangeRatesReturn = ReturnType<typeof useExchangeRates>
