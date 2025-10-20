import { useMemo } from 'react'
import type { ComponentProps } from 'react'
import CurrencySelector from './CurrencySelector'
import { useExchangeRates } from '@/utils/hooks/useExchangeRates'
import { normalizeCurrencyCode } from '@/utils/currency'
import { useAppSelector } from '@/store'
import type { CurrencyCode } from '@/store/slices/currency/currencySlice'

type CurrencySelectorProps = ComponentProps<typeof CurrencySelector>

type SelectAcceptedCurrenciesProps = Omit<
    CurrencySelectorProps,
    'options' | 'value' | 'onChange'
> & {
    value?: CurrencyCode
    onChange?: (code: CurrencyCode) => void
    includeUnknownValue?: boolean
}

const SelectAcceptedCurrencies = ({
    value,
    onChange,
    includeUnknownValue = true,
    ...rest
}: SelectAcceptedCurrenciesProps) => {
    const { snapshot } = useExchangeRates({
        autoRefresh: true,
    })
    const acceptedCurrencies = useAppSelector((state) => state.currency.available)

    const acceptedCurrencyCodes = useMemo(() => {
        const normalized = (acceptedCurrencies || [])
            .map((code) => normalizeCurrencyCode(code, snapshot.base))
            .filter((code): code is CurrencyCode => Boolean(code))
        if (normalized.length) {
            return Array.from(new Set(normalized))
        }
        const fallback = normalizeCurrencyCode(snapshot.base, snapshot.base)
        return fallback ? [fallback as CurrencyCode] : []
    }, [acceptedCurrencies, snapshot.base])

    const normalizedValue = useMemo(() => {
        if (!value) {
            return undefined
        }
        return (
            (normalizeCurrencyCode(value, snapshot.base) as CurrencyCode | undefined) ||
            (value as CurrencyCode)
        )
    }, [snapshot.base, value])

    const options = useMemo(() => {
        const labelMap = new Map<CurrencyCode, string>()
        snapshot.options.forEach((option) => {
            if (option?.value) {
                const normalized =
                    normalizeCurrencyCode(option.value, snapshot.base) || option.value
                labelMap.set(
                    normalized as CurrencyCode,
                    option.label || (normalized as CurrencyCode),
                )
            }
        })

        const optionSource = acceptedCurrencyCodes.map((code) => ({
            value: code,
            label: labelMap.get(code) ?? code,
        }))

        if (
            normalizedValue &&
            includeUnknownValue &&
            !optionSource.some((opt) => opt.value === normalizedValue)
        ) {
            return optionSource.concat({
                value: normalizedValue,
                label: labelMap.get(normalizedValue) ?? normalizedValue,
            })
        }

        return optionSource
    }, [
        acceptedCurrencyCodes,
        includeUnknownValue,
        normalizedValue,
        snapshot.base,
        snapshot.options,
    ])

    return (
        <CurrencySelector
            {...rest}
            value={normalizedValue}
            onChange={onChange}
            options={options}
        />
    )
}

export type { SelectAcceptedCurrenciesProps }
export default SelectAcceptedCurrencies
