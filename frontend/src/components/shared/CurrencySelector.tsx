import { useEffect, useMemo } from 'react'
import Select from '@/components/ui/Select'
import type { CommonProps } from '@/@types/common'
import {
    useAppDispatch,
    useAppSelector,
    setCurrency,
    setAvailableCurrencies,
    type CurrencyCode,
} from '@/store'
import { apiGetSystemCurrencies } from '@/services/SettingsService'
import { formatCurrencyOptionLabel, getStandardFallbackCurrencies } from '@/utils/currency'

type Size = 'sm' | 'md' | 'lg'

type CurrencyOption = {
    value: CurrencyCode
    label: string
}

type CurrencySelectorProps = CommonProps & {
    size?: Size
    selectClassName?: string
    embedded?: boolean
    value?: CurrencyCode
    onChange?: (code: CurrencyCode) => void
    options?: CurrencyOption[]
}

const CurrencySelector = ({
    className,
    size = 'md',
    selectClassName = 'w-28',
    embedded = false,
    value,
    onChange,
    options,
}: CurrencySelectorProps) => {
    const dispatch = useAppDispatch()
    const currencyState = useAppSelector((state) => state.currency)

    const standardFallback = useMemo(
        () => Array.from(new Set<CurrencyCode>(['UYU', 'USD', ...getStandardFallbackCurrencies()])),
        [currencyState.catalog.defaultCodes],
    )

    const currency = currencyState?.code || standardFallback[0]
    const availableList = Array.isArray(currencyState?.available)
        ? currencyState?.available
        : standardFallback
    const loaded = Boolean(currencyState?.loaded)

    useEffect(() => {
        if (options || loaded) {
            return
        }
        let ignore = false
        const fetchCurrencies = async () => {
            try {
                const res = await apiGetSystemCurrencies<CurrencyCode[]>()
                if (!ignore && Array.isArray(res.data)) {
                    dispatch(setAvailableCurrencies(res.data))
                }
            } catch (error) {
                if (!ignore) {
                    dispatch(setAvailableCurrencies([]))
                }
            }
        }
        fetchCurrencies()
        return () => {
            ignore = true
        }
    }, [dispatch, loaded, options])

    const resolvedOptions: CurrencyOption[] = useMemo(() => {
        if (options && Array.isArray(options)) {
            return options.map((item) => ({
                value: item.value,
                label: formatCurrencyOptionLabel(item.value, item.label),
            }))
        }
        const source = availableList.length ? availableList : standardFallback
        return source.map((value) => ({
            value,
            label: formatCurrencyOptionLabel(value),
        }))
    }, [availableList, options, standardFallback])

    const currentValue = value ?? currency
    const selected =
        resolvedOptions.find((o) => o.value === currentValue) ||
        (currentValue
            ? { value: currentValue, label: currentValue }
            : resolvedOptions[0] ||
              (standardFallback[0]
                  ? { value: standardFallback[0], label: formatCurrencyOptionLabel(standardFallback[0]) }
                  : undefined))

    const handleChange = (opt: unknown) => {
        const next = (opt as CurrencyOption | null)?.value
        if (!next) {
            return
        }
        if (onChange) {
            onChange(next)
        } else {
            dispatch(setCurrency(next))
        }
    }

    return (
        <div className={className}>
            <Select
                size={size}
                className={selectClassName}
                // When embedded inside InputGroup.Addon, drop control border/background
                style={
                    embedded
                        ? {
                              control: (provided: any) => ({
                                  ...provided,
                                  border: 'none',
                                  boxShadow: 'none',
                                  background: 'transparent',
                                  minHeight: 'unset',
                                  height: '100%',
                                  paddingLeft: 0,
                                  paddingRight: 0,
                              }),
                              valueContainer: (provided: any) => ({
                                  ...provided,
                                  paddingLeft: 4,
                                  paddingRight: 4,
                              }),
                              indicatorsContainer: (provided: any) => ({
                                  ...provided,
                                  paddingRight: 2,
                              }),
                          }
                        : undefined
                }
                options={resolvedOptions}
                value={selected as any}
                onChange={handleChange}
            />
        </div>
    )
}

export default CurrencySelector
