import { useRef } from 'react'
import Input from '@/components/ui/Input'
import { HiOutlineSearch } from 'react-icons/hi'
import {
    getOrders,
    setTableData,
    useAppDispatch,
    useSalesOrderListData,
    setSelectedRows,
} from '../store'
import type { SalesTableQueries } from '../store'
import debounce from 'lodash/debounce'
import cloneDeep from 'lodash/cloneDeep'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSalesDocumentI18n } from '../../context/useSalesDocumentI18n'

const OrderTableSearch = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()
    const { resource } = useSalesDocumentI18n()

    const searchInput = useRef<HTMLInputElement>(null)

    const { tableData } = useSalesOrderListData()

    const debounceFn = debounce(handleDebounceFn, 500)

    function handleDebounceFn(val: string) {
        const newTableData = cloneDeep(tableData)
        newTableData.query = val
        newTableData.pageIndex = 1
        if (typeof val === 'string' && val.length > 1) {
            fetchData(newTableData)
        }

        if (typeof val === 'string' && val.length === 0) {
            fetchData(newTableData)
        }
    }

    const fetchData = (data: SalesTableQueries) => {
        dispatch(setSelectedRows([]))
        dispatch(setTableData({ ...data, resource }))
        dispatch(getOrders({ ...data, resource }))
    }

    const onEdit = (e: ChangeEvent<HTMLInputElement>) => {
        debounceFn(e.target.value)
    }

    return (
        <Input
            ref={searchInput}
            className="lg:w-52"
            size="sm"
            name="order-search"
            placeholder={t('text.placeholders.search')}
            prefix={<HiOutlineSearch className="text-lg" />}
            onChange={onEdit}
        />
    )
}

export default OrderTableSearch
