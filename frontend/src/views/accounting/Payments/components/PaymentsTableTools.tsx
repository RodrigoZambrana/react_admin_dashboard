import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { HiOutlinePlus, HiOutlineSearch } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import {
    useAppDispatch,
    useAppSelector,
    setTableData,
    togglePaymentDialog,
} from '../store'
import type { PaymentsTableState, PaymentStatus, PaymentType } from '../store/paymentsSlice'

const PaymentsTableTools = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const tableData = useAppSelector((state) => state.accountingPayments.data.tableData)

    const [searchValue, setSearchValue] = useState<string>(tableData.query ?? '')

    useEffect(() => {
        setSearchValue(tableData.query ?? '')
    }, [tableData.query])

    const onSearch = () => {
        const payload: PaymentsTableState = {
            ...tableData,
            pageIndex: 1,
            query: searchValue.trim(),
        }
        dispatch(setTableData(payload))
    }

    const onStatusChange = (value: PaymentStatus | '') => {
        const payload: PaymentsTableState = {
            ...tableData,
            pageIndex: 1,
            status: value,
        }
        dispatch(setTableData(payload))
    }

    const onTypeChange = (value: PaymentType | '') => {
        const payload: PaymentsTableState = {
            ...tableData,
            pageIndex: 1,
            type: value,
        }
        dispatch(setTableData(payload))
    }

    const onCreate = () => {
        dispatch(togglePaymentDialog({ open: true, mode: 'create', paymentId: null }))
    }

    const computedStatusOptions = useMemo(
        () => [
            { value: '' as PaymentStatus | '', label: t('accounting.payments.filters.statusAll') },
            { value: 'CONFIRMED' as PaymentStatus, label: t('accounting.payments.status.confirmed') },
            { value: 'REGISTERED' as PaymentStatus, label: t('accounting.payments.status.registered') },
            { value: 'FAILED' as PaymentStatus, label: t('accounting.payments.status.failed') },
        ],
        [t],
    )

    const computedTypeOptions = useMemo(
        () => [
            { value: '' as PaymentType | '', label: t('accounting.payments.filters.typeAll') },
            { value: 'DEPOSIT' as PaymentType, label: t('accounting.payments.type.deposit') },
            { value: 'BALANCE' as PaymentType, label: t('accounting.payments.type.balance') },
            { value: 'REFUND' as PaymentType, label: t('accounting.payments.type.refund') },
        ],
        [t],
    )

    return (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full">
            <div className="flex items-center gap-2">
                <Input
                    size="sm"
                    placeholder={t('accounting.payments.filters.searchPlaceholder') as string}
                    prefix={<HiOutlineSearch className="text-lg" />}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onSearch()
                        }
                    }}
                />
                <Button size="sm" variant="solid" onClick={onSearch}>
                    {t('accounting.payments.actions.search')}
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Select
                    size="sm"
                    className="min-w-[160px]"
                    options={computedStatusOptions}
                    value={
                        computedStatusOptions.find(
                            (option) => option.value === (tableData.status ?? ''),
                        ) ?? computedStatusOptions[0]
                    }
                    onChange={(option) =>
                        onStatusChange(option ? (option as { value: PaymentStatus | '' }).value : '')
                    }
                />
                <Select
                    size="sm"
                    className="min-w-[160px]"
                    options={computedTypeOptions}
                    value={
                        computedTypeOptions.find(
                            (option) => option.value === (tableData.type ?? ''),
                        ) ?? computedTypeOptions[0]
                    }
                    onChange={(option) =>
                        onTypeChange(option ? (option as { value: PaymentType | '' }).value : '')
                    }
                />
            </div>
            <div className="flex-1 lg:flex-none" />
            <Button size="sm" variant="solid" icon={<HiOutlinePlus />} onClick={onCreate}>
                {t('accounting.payments.actions.new')}
            </Button>
        </div>
    )
}

export default PaymentsTableTools
