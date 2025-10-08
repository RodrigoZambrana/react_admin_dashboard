import { useRef } from 'react'
import Input from '@/components/ui/Input'
import { HiOutlineSearch } from 'react-icons/hi'
import {
    getProducts,
    setTableData,
    useAppSelector,
    useAppDispatch,
} from '../store'
import debounce from 'lodash/debounce'
import cloneDeep from 'lodash/cloneDeep'
import type { TableQueries } from '@/@types/common'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

const ProductTableSearch = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const searchInput = useRef(null)

    const tableData = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )
    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )

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

    const fetchData = (data: TableQueries) => {
        dispatch(setTableData(data))
        dispatch(
            getProducts({
                ...data,
                filterData,
            }),
        )
    }

    const onEdit = (e: ChangeEvent<HTMLInputElement>) => {
        debounceFn(e.target.value)
    }

    return (
        <Input
            ref={searchInput}
            className="w-full md:w-80 lg:w-[28rem] md:mb-0 mb-4"
            size="md"
            placeholder={t('text.placeholders.searchProduct')}
            prefix={<HiOutlineSearch className="text-lg" />}
            onChange={onEdit}
        />
    )
}

export default ProductTableSearch
