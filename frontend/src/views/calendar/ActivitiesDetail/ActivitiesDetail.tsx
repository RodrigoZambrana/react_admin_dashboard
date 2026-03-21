import { useEffect } from 'react'
import Loading from '@/components/shared/Loading'
import Container from '@/components/shared/Container'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import ActivityProfile from './components/ActivityProfile'
import ActivityDescription from './components/ActivityDescription'
import ActivityAttachments from './components/ActivityAttachments'
import ActivityComments from './components/ActivityComments'
import ActivityCustomerInfo from './components/ActivityCustomerInfo'
import reducer, {
    getActivity,
    useAppDispatch,
    useAppSelector,
} from './store'
import { injectReducer } from '@/store'
import crmReducer, { getCustomer } from '@/views/crm/CustomerDetail/store'
import calendarReducer, {
    openDialog as openCalendarDialog,
    setSelected as setCalendarSelected,
    updateCalendarEvent,
    createCalendarEvent,
    deleteCalendarEvent,
} from '@/views/crm/Calendar/store'
import EventDialog from '@/views/crm/Calendar/components/EventDialog'
import isEmpty from 'lodash/isEmpty'
import { useTranslation } from 'react-i18next'
import useQuery from '@/utils/hooks/useQuery'
import { useSelector } from 'react-redux'

injectReducer('calendarActivityDetails', reducer)
// Also inject CRM reducer so reused CRM components work here when activities
// are tied to users. If not tied, components will render empty gracefully.
injectReducer('crmCustomerDetails', crmReducer)
injectReducer('crmCalendar', calendarReducer)

const ActivitiesDetail = () => {
    const dispatch = useAppDispatch()

    const query = useQuery()

    const data = useAppSelector(
        (state) => state.calendarActivityDetails.data.profileData,
    )
    const crmLoadedId = useSelector(
        (state: any) => state.crmCustomerDetails?.data?.profileData?.id,
    )
    const customer = useSelector(
        (state: any) => state.crmCustomerDetails?.data?.profileData,
    )
    const customerLoading = useSelector(
        (state: any) => state.crmCustomerDetails?.data?.loading,
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
    const linkedCustomerId =
        (data as any)?.customerId ||
        query.get('customerId') ||
        query.get('crmId') ||
        query.get('userId')

    const hasLinkedCustomer = Boolean(linkedCustomerId)

    return (
        <Container className="h-full">
            <Loading loading={loading}>
                {!isEmpty(data) && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4">
                            <ActivityProfile
                                data={data}
                                onEdit={() => {
                                    if (!data?.sourceEvent) {
                                        return
                                    }
                                    const event = data.sourceEvent
                                    dispatch(
                                        setCalendarSelected({
                                            type: 'EDIT',
                                            id: event.id,
                                            title: event.title,
                                            start: event.start,
                                            end: event.end,
                                            allDay: event.allDay,
                                            eventColor: event.eventColor,
                                            eventTypeId:
                                                event.eventTypeId?.toString?.() ||
                                                event.extendedProps?.eventTypeId,
                                            extendedProps: event.extendedProps,
                                        }),
                                    )
                                    dispatch(openCalendarDialog())
                                }}
                            />
                            {hasLinkedCustomer && (
                                <ActivityCustomerInfo
                                    customer={customer}
                                    isLinked={hasLinkedCustomer}
                                    loading={hasLinkedCustomer && customerLoading}
                                />
                            )}
                            <ActivityDescription description={(data as any)?.detail} />
                            <ActivityComments activityId={String(data?.id || '')} />
                            <ActivityAttachments
                                attachments={(data as any)?.attachments}
                                sourceEvent={data?.sourceEvent as any}
                                onRefresh={() => {
                                    if (data?.id) {
                                        dispatch(getActivity({ id: String(data.id) }))
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </Loading>
            <EventDialog
                submit={async (event, type) => {
                    try {
                        if (type === 'EDIT') {
                            await dispatch(updateCalendarEvent(event)).unwrap()
                        } else {
                            await dispatch(createCalendarEvent(event)).unwrap()
                        }
                        if (data?.id) {
                            await dispatch(getActivity({ id: String(data.id) }))
                        }
                    } catch {
                        // Notification handled inside slices
                    }
                }}
                onDelete={async (id) => {
                    try {
                        await dispatch(deleteCalendarEvent(id)).unwrap()
                        if (data?.id) {
                            await dispatch(getActivity({ id: String(data.id) }))
                        }
                    } catch {
                        // handled by slice notifications
                    }
                }}
            />
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
