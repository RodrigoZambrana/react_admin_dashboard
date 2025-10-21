import { combineReducers } from '@reduxjs/toolkit'
import reducers, {
    SLICE_NAME,
    SalesOrderListState,
    initialState,
} from './orderListSlice'
import { useSelector } from 'react-redux'

import type { TypedUseSelectorHook } from 'react-redux'
import type { RootState } from '@/store'

const reducer = combineReducers({
    data: reducers,
})

type SalesOrderListSliceState = {
    data: SalesOrderListState
}

type SelectorState = RootState & {
    [SLICE_NAME]?: SalesOrderListSliceState
}

export const useAppSelector: TypedUseSelectorHook<
    SelectorState
> = useSelector

export const useSalesOrderListData = () =>
    useAppSelector((state) => state[SLICE_NAME]?.data ?? initialState)

export * from './orderListSlice'
export { useAppDispatch } from '@/store'
export default reducer
