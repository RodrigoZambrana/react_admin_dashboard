import { useEffect } from 'react'
import reducer, {
    getCustomersDashboardData,
    useAppDispatch,
    useAppSelector,
} from './store'
import { injectReducer } from '@/store/'

import Loading from '@/components/shared/Loading'
import Statistic from './components/Statistic'
import LeadByCountries from './components/LeadByCountries'
import EmailSent from './components/EmailSent'
import Leads from './components/Leads'

injectReducer('customersDashboard', reducer)

const CrmDashboard = () => {
    const dispatch = useAppDispatch()

    const { statisticData, leadByRegionData, recentLeadsData, emailSentData } =
        useAppSelector((state) => state.customersDashboard.data.dashboardData)
    const loading = useAppSelector(
        (state) => state.customersDashboard.data.loading,
    )

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchData = () => {
        dispatch(getCustomersDashboardData())
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <Loading loading={loading}>
                <Statistic data={statisticData} />
                <div className="grid grid-cols-1 xl:grid-cols-7 gap-4">
                    <LeadByCountries
                        className="xl:col-span-5"
                        data={leadByRegionData}
                    />
                    <EmailSent className="xl:col-span-2" data={emailSentData} />
                </div>
                <Leads data={recentLeadsData} />
            </Loading>
        </div>
    )
}

export default CrmDashboard
