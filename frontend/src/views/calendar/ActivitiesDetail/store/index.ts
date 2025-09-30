import { combineReducers } from '@reduxjs/toolkit'
import reducers, {
    SLICE_NAME,
    ActivityDetailState,
} from './slice'
import { useSelector } from 'react-redux'

import type { TypedUseSelectorHook } from 'react-redux'
import type { RootState } from '@/store'

const reducer = combineReducers({
    data: reducers,
})

export const useAppSelector: TypedUseSelectorHook<
    RootState & {
        [SLICE_NAME]: {
            data: ActivityDetailState
        }
    }
> = useSelector

export * from './slice'
export { useAppDispatch } from '@/store'
export default reducer

