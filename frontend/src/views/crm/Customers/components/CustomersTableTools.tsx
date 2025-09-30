import { useRef } from 'react'
import Button from '@/components/ui/Button'
import {
    getCustomers,
    setTableData,
    setFilterData,
    useAppDispatch,
    useAppSelector,
    setSelectedCustomer,
    setDrawerOpen,
} from '../store'
import CustomerTableSearch from './CustomerTableSearch'
import CustomerTableFilter from './CustomerTableFilter'
import cloneDeep from 'lodash/cloneDeep'
import type { TableQueries } from '@/@types/common'
import { useTranslation } from 'react-i18next'
import { HiOutlinePlusCircle } from 'react-icons/hi'

const CustomersTableTools = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const inputRef = useRef<HTMLInputElement>(null)

    const tableData = useAppSelector(
        (state) => state.crmCustomers.data.tableData,
    )

    const handleInputChange = (val: string) => {
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

    const fetchData = (data: TableQueries) => {
        dispatch(setTableData(data))
        dispatch(getCustomers(data))
    }

    const onClearAll = () => {
        const newTableData = cloneDeep(tableData)
        newTableData.query = ''
        if (inputRef.current) {
            inputRef.current.value = ''
        }
        dispatch(setFilterData({ statusId: null }))
        fetchData(newTableData)
    }

    const onAddNewCustomer = () => {
        dispatch(setSelectedCustomer({}))
        dispatch(setDrawerOpen())
    }

    return (
        <div className="md:flex items-center justify-between">
            <div className="md:flex items-center gap-4">
                <CustomerTableSearch
                    ref={inputRef}
                    onInputChange={handleInputChange}
                />
                <CustomerTableFilter />
            </div>
            <div className="mb-4 flex items-center gap-2">
                <Button size="sm" onClick={onClearAll}>
                    {t('text.actions.clearAll')}
                </Button>
                <Button
                    size="sm"
                    variant="twoTone"
                    icon={<HiOutlinePlusCircle />}
                    onClick={onAddNewCustomer}
                >
                    {t('text.titles.addNewCustomer')}
                </Button>
            </div>
        </div>
    )
}

export default CustomersTableTools
