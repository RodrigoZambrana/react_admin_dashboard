import { useEffect } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Loading from '@/components/shared/Loading'
import Container from '@/components/shared/Container'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import ActivityProfile from './components/ActivityProfile'
import ActivityCurrentSubscription from './components/ActivityCurrentSubscription'
import ActivityPaymentHistory from './components/ActivityPaymentHistory'
import ActivityPaymentMethods from './components/ActivityPaymentMethods'
import ActivityEditProfile from './components/ActivityEditProfile'
import reducer, {
    getActivity,
    useAppDispatch,
    useAppSelector,
} from './store'
import { injectReducer } from '@/store'
import crmReducer from '@/views/crm/CustomerDetail/store'
import { getCustomer } from '@/views/crm/CustomerDetail/store'
import isEmpty from 'lodash/isEmpty'
import { useTranslation } from 'react-i18next'
import useQuery from '@/utils/hooks/useQuery'
import { useSelector } from 'react-redux'

injectReducer('calendarActivityDetails', reducer)
// Also inject CRM reducer so reused CRM components work here when activities
// are tied to users. If not tied, components will render empty gracefully.
injectReducer('crmCustomerDetails', crmReducer)

const ActivitiesDetail = () => {
    const dispatch = useAppDispatch()

    const query = useQuery()

    const data = useAppSelector(
        (state) => state.calendarActivityDetails.data.profileData,
    )
    const crmLoadedId = useSelector(
        (state: any) => state.crmCustomerDetails?.data?.profileData?.id,
    )
    const loading = useAppSelector(
        (state) => state.calendarActivityDetails.data.loading,
    )

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Auto-fetch CRM customer if activity payload references a customer/user id
    useEffect(() => {
        if (!data) return
        const linkId =
            (data as any)?.customerId ||
            (data as any)?.crmId ||
            (data as any)?.userId ||
            (data as any)?.linkedCustomerId ||
            (data as any)?.linkedUserId
        if (linkId && String(linkId) !== String(crmLoadedId || '')) {
            dispatch(getCustomer({ id: String(linkId) }))
        }
    }, [data, crmLoadedId, dispatch])

    const fetchData = () => {
        const id = query.get('id')
        if (id) {
            dispatch(getActivity({ id }))
        }
        const crmId = query.get('customerId') || query.get('crmId') || query.get('userId')
        if (crmId) {
            dispatch(getCustomer({ id: crmId }))
        }
    }

    const { t } = useTranslation()
    return (
        <Container className="h-full">
            <Loading loading={loading}>
                {!isEmpty(data) && (
                    <div className="flex flex-col xl:flex-row gap-4">
                        <div>
                            <ActivityProfile data={data} />
                        </div>
                        <div className="w-full">
                            <AdaptableCard>
                                <ActivityCurrentSubscription />
                                <ActivityPaymentHistory />
                                <ActivityPaymentMethods />
                            </AdaptableCard>
                        </div>
                    </div>
                )}
            </Loading>
            <ActivityEditProfile />
            {!loading && isEmpty(data) && (
                <div className="h-full flex flex-col items-center justify-center">
                    <DoubleSidedImage
                        src="/img/others/img-2.png"
                        darkModeSrc="/img/others/img-2-dark.png"
                        alt={t('common.notFound.user')}
                    />
                    <h3 className="mt-8">{t('common.notFound.user')}</h3>
                </div>
            )}
        </Container>
    )
}

export default ActivitiesDetail
