import { combineReducers } from '@reduxjs/toolkit'
import reducer, {
    SLICE_NAME,
    type PaymentsState,
    getPayments,
    setTableData,
    setPayments,
    togglePaymentDialog,
    toggleDeleteDialog,
} from './paymentsSlice'
import { useSelector } from 'react-redux'
import type { TypedUseSelectorHook } from 'react-redux'
import type { RootState } from '@/store'

const combinedReducer = combineReducers({
    data: reducer,
})

export const useAppSelector: TypedUseSelectorHook<
    RootState & {
        [SLICE_NAME]: {
            data: PaymentsState
        }
    }
> = useSelector

export {
    SLICE_NAME,
    getPayments,
    setTableData,
    setPayments,
    togglePaymentDialog,
    toggleDeleteDialog,
}

export { useAppDispatch } from '@/store'

export default combinedReducer
