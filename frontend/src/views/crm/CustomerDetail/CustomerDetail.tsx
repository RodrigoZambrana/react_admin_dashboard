import { useEffect } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Loading from '@/components/shared/Loading'
import Container from '@/components/shared/Container'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import CustomerProfile from './components/CustomerProfile'
import OrdersHistory from './components/OrdersHistory'
import CustomerAddresses from './components/CustomerAddresses'
import reducer, { getCustomer, useAppDispatch, useAppSelector } from './store'

import { injectReducer } from '@/store'
import isEmpty from 'lodash/isEmpty'
import { useTranslation } from 'react-i18next'
import useQuery from '@/utils/hooks/useQuery'

injectReducer('crmCustomerDetails', reducer)

const CustomerDetail = () => {
    const dispatch = useAppDispatch()

    const query = useQuery()

    const data = useAppSelector(
        (state) => state.crmCustomerDetails.data.profileData,
    )
    const loading = useAppSelector(
        (state) => state.crmCustomerDetails.data.loading,
    )

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchData = () => {
        const id = query.get('id')
        if (id) {
            dispatch(getCustomer({ id }))
        }
    }

    const { t } = useTranslation()
    return (
        <Container className="h-full">
            <Loading loading={loading}>
        {!isEmpty(data) && (
                    <div className="flex flex-col gap-4">
                        <CustomerProfile data={data} />
                        <CustomerAddresses
                            customerId={String(data.id)}
                            className="mt-0"
                        />
                        <AdaptableCard>
                            <OrdersHistory />
                        </AdaptableCard>
                    </div>
                )}
            </Loading>
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

export default CustomerDetail
