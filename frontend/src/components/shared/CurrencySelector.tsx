import Select from '@/components/ui/Select'
import type { CommonProps } from '@/@types/common'
import { useAppDispatch, useAppSelector, setCurrency } from '@/store'

type Size = 'sm' | 'md' | 'lg'

type CurrencySelectorProps = CommonProps & {
    size?: Size
    selectClassName?: string
    embedded?: boolean
}

const options = [
    { value: 'UYU', label: 'UYU' },
    { value: 'USD', label: 'USD' },
]

const CurrencySelector = ({ className, size = 'md', selectClassName = 'w-28', embedded = false }: CurrencySelectorProps) => {
    const dispatch = useAppDispatch()
    const currency = useAppSelector((state) => state.currency.code)

    const selected = options.find((o) => o.value === currency) || options[0]

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
                options={options}
                value={selected as any}
                onChange={(opt) => dispatch(setCurrency((opt as any).value))}
            />
        </div>
    )
}

export default CurrencySelector
