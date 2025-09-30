import { useEffect, useMemo, useState } from 'react'
import Select from '@/components/ui/Select'
import { setFilterData, useAppDispatch, useAppSelector } from '../store'
import { useTranslation } from 'react-i18next'
import { apiGetCustomerStatuses } from '@/services/SettingsService'
import type { SingleValue } from 'react-select'

type StatusOption = {
    value: number | string
    label: string
    color?: string
}

const CustomerTableFilter = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()
    const [statusOptions, setStatusOptions] = useState<StatusOption[]>([])

    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const res = await apiGetCustomerStatuses<
                    { id: string | number; name: string }[]
                >()
                const normalized: StatusOption[] = ((res.data as any[]) || []).map(
                    (item) => {
                        const parsed = Number(item.id)
                        const value = Number.isNaN(parsed)
                            ? String(item.id)
                            : parsed
                        return {
                            value,
                            label: item.name,
                            color: item.color,
                        }
                    },
                )
                setStatusOptions(normalized)
            } catch (
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                _error
            ) {
                setStatusOptions([])
            }
        }
        fetchStatuses()
    }, [])

    const selectOptions = useMemo(() => {
        return [
            { value: 'all', label: t('text.filters.all'), color: '#6b7280' },
            ...statusOptions,
        ]
    }, [statusOptions, t])

    const { statusId } = useAppSelector(
        (state) => state.crmCustomers.data.filterData,
    )

    const onStatusFilterChange = (selected: SingleValue<StatusOption>) => {
        const value = selected?.value
        let normalized: string | number | null = null

        if (value === undefined || value === null) {
            normalized = null
        } else if (value === 'all') {
            normalized = null
        } else if (typeof value === 'number') {
            normalized = value
        } else {
            const parsed = Number(value)
            normalized = Number.isNaN(parsed) ? value : parsed
        }

        dispatch(
            setFilterData({
                statusId: normalized,
            }),
        )
    }

    const selectedOption = selectOptions.find(
        (option) =>
            (statusId === null && option.value === 'all') ||
            (statusId !== null && String(option.value) === String(statusId)),
    )

    return (
        <Select<StatusOption>
            options={selectOptions}
            size="sm"
            className="mb-4 min-w-[160px]"
            formatOptionLabel={(opt) => (
                <div className="flex items-center gap-2">
                    <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                            backgroundColor: opt.color || '#6b7280',
                        }}
                    />
                    <span className="capitalize">{opt.label}</span>
                </div>
            )}
            value={selectedOption ?? selectOptions[0]}
            onChange={onStatusFilterChange}
        />
    )
}

export default CustomerTableFilter
