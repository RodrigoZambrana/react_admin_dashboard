import { useEffect } from 'react'

import { injectReducer, useAppDispatch, useAppSelector } from '@/store'

import reducer, {
    getAnalyticsDashboardData,
    type AnalyticsDashboardState,
} from '../store'

injectReducer('analyticsDashboard', reducer)

type AnalyticsDashboardRootState = {
    analyticsDashboard?: { data: AnalyticsDashboardState }
}

export const useAnalyticsDashboardData = () => {
    const dispatch = useAppDispatch()
    const dashboardSlice = useAppSelector(
        (state) => (state as AnalyticsDashboardRootState).analyticsDashboard?.data,
    )

    useEffect(() => {
        void dispatch(getAnalyticsDashboardData() as any)
    }, [dispatch])

    return {
        loading: dashboardSlice?.loading ?? false,
        dashboardData: dashboardSlice?.dashboardData,
    }
}

