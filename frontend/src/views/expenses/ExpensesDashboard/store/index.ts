import { combineReducers } from '@reduxjs/toolkit'
import reducers, {
    SLICE_NAME,
    ExpensesDashboardState,
} from './expensesDashboardSlice'
import { useSelector } from 'react-redux'

import type { TypedUseSelectorHook } from 'react-redux'
import type { RootState } from '@/store'

const reducer = combineReducers({
    data: reducers,
})

export const useAppSelector: TypedUseSelectorHook<
    RootState & {
        [SLICE_NAME]: {
            data: ExpensesDashboardState
        }
    }
> = useSelector

export * from './expensesDashboardSlice'
export { useAppDispatch } from '@/store'
export default reducer

