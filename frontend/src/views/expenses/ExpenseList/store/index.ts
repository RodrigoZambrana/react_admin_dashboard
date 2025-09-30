import { combineReducers } from '@reduxjs/toolkit'
import reducers, { SLICE_NAME, ExpensesListState } from './expenseListSlice'
import { useSelector } from 'react-redux'

import type { TypedUseSelectorHook } from 'react-redux'
import type { RootState } from '@/store'

const reducer = combineReducers({
    data: reducers,
})

export const useAppSelector: TypedUseSelectorHook<
    RootState & {
        [SLICE_NAME]: {
            data: ExpensesListState
        }
    }
> = useSelector

export * from './expenseListSlice'
export { useAppDispatch } from '@/store'
export default reducer

