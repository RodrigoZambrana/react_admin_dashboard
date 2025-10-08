import { forwardRef } from 'react'
import CustomerFormDrawer from '@/components/shared/CustomerFormDrawer'
import type { FormModel } from '@/views/crm/CustomerForm'
import {
    setCustomerList,
    getCustomers,
    useAppDispatch,
    useAppSelector,
    Customer,
} from '../store'
import dayjs from 'dayjs'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useTranslation } from 'react-i18next'
import { apPutCrmCustomer } from '@/services/CrmService'
import {
    composeCustomerPayload,
    normalizeCustomerForSuccess,
} from '@/components/shared/customerFormUtils'

type CustomerEditContentProps = {
    isOpen: boolean
    onClose: () => void
    activeTab: 'personalInfo' | 'address'
    onTabChange: (tab: 'personalInfo' | 'address') => void
    onAddressCompleteChange?: (complete: boolean) => void
    customerData?: Partial<Customer>
}

const CustomerEditContent = forwardRef<unknown, CustomerEditContentProps>(
    ({ isOpen, onClose, activeTab, onTabChange, onAddressCompleteChange, customerData }, _ref) => {
        const dispatch = useAppDispatch()
        const { t } = useTranslation()
        const selected = useAppSelector(
            (state) => state.crmCustomers.data.selectedCustomer,
        )
        const customer = customerData || selected
        const data = useAppSelector((state) => state.crmCustomers.data.customerList)
        const tableData = useAppSelector((state) => state.crmCustomers.data.tableData)
        const filterData = useAppSelector((state) => state.crmCustomers.data.filterData)

        const toCustomerEntity = (
            normalized: Record<string, unknown>,
            formValues: FormModel,
            previous?: Partial<Customer>,
        ): Customer => {
            const personal = (normalized.personalInfo as Record<string, unknown>) || {}
            const phoneNumbers =
                (normalized.phoneNumbers as string[] | undefined) ||
                previous?.phoneNumbers ||
                formValues.phoneNumbers ||
                []
            const primaryPhone =
                (normalized.phoneNumber as string | undefined) ||
                phoneNumbers[0] ||
                previous?.phoneNumber ||
                formValues.phoneNumber ||
                ''

            const nameFromForm = [formValues.firstName, formValues.lastName]
                .map((part) => String(part || '').trim())
                .filter((part) => part.length > 0)
                .join(' ')

            return {
                id: String(normalized.id ?? previous?.id ?? ''),
                name:
                    (normalized.name as string) ||
                    previous?.name ||
                    nameFromForm ||
                    '',
                firstName:
                    (normalized.firstName as string) ||
                    previous?.firstName ||
                    formValues.firstName ||
                    '',
                lastName:
                    (normalized.lastName as string) ||
                    previous?.lastName ||
                    formValues.lastName ||
                    '',
                email:
                    (normalized.email as string) ||
                    previous?.email ||
                    formValues.email ||
                    '',
                img:
                    (normalized.img as string) ||
                    previous?.img ||
                    formValues.img ||
                    '',
                role: previous?.role || 'User',
                lastOnline: previous?.lastOnline || dayjs().unix(),
                status:
                    (normalized.statusName as string) ||
                    (normalized.status as string) ||
                    previous?.status ||
                    previous?.statusName ||
                    '',
                statusId:
                    normalized.statusId !== undefined
                        ? (normalized.statusId as number | string | null)
                        : previous?.statusId ?? null,
                statusName:
                    (normalized.statusName as string) ||
                    previous?.statusName ||
                    (normalized.status as string) ||
                    previous?.status ||
                    '',
                phoneNumber: primaryPhone,
                phoneNumbers,
                personalInfo: {
                    location:
                        (personal.location as string) ||
                        previous?.personalInfo?.location ||
                        formValues.location ||
                        '',
                    phoneNumber:
                        (personal.phoneNumber as string) ||
                        previous?.personalInfo?.phoneNumber ||
                        primaryPhone,
                    phoneNumbers:
                        (personal.phoneNumbers as string[]) ||
                        previous?.personalInfo?.phoneNumbers ||
                        phoneNumbers,
                    facebook:
                        (personal.facebook as string) ||
                        previous?.personalInfo?.facebook ||
                        formValues.facebook ||
                        '',
                    twitter:
                        (personal.twitter as string) ||
                        previous?.personalInfo?.twitter ||
                        formValues.twitter ||
                        '',
                    pinterest:
                        (personal.pinterest as string) ||
                        previous?.personalInfo?.pinterest ||
                        formValues.pinterest ||
                        '',
                    linkedIn:
                        (personal.linkedIn as string) ||
                        previous?.personalInfo?.linkedIn ||
                        formValues.linkedIn ||
                        '',
                },
                orderHistory: previous?.orderHistory || [],
                paymentMethod: previous?.paymentMethod || [],
                subscription: previous?.subscription || [],
                addresses:
                    (normalized.addresses as Array<Record<string, unknown>>) ||
                    previous?.addresses ||
                    [],
            }
        }

        const updateCustomerList = (
            list: Customer[],
            updated: Customer,
        ): Customer[] => {
            const updatedId = String(updated.id)
            const existingIndex = list.findIndex(
                (item) => String(item.id) === updatedId,
            )

            if (existingIndex === -1) {
                return [updated, ...list]
            }

            return list.map((item, index) =>
                index === existingIndex
                    ? {
                          ...item,
                          ...updated,
                          personalInfo: {
                              ...item.personalInfo,
                              ...updated.personalInfo,
                          },
                          addresses: updated.addresses,
                      }
                    : item,
            )
        }

        const handleSubmit = async (values: FormModel) => {
            const payload = composeCustomerPayload(values, customer)

            try {
                const response = await apPutCrmCustomer<any, typeof payload>(payload)
                const saved = (response as any).data || (response as any)

                if (!saved?.id) {
                    throw new Error(
                        t('text.validation.failed', {
                            defaultValue: 'Unable to save customer',
                        }),
                    )
                }

                const normalized = normalizeCustomerForSuccess(saved, values)
                const normalizedCustomer = toCustomerEntity(normalized, values, customer || undefined)

                const updatedList = updateCustomerList(data, normalizedCustomer)
                dispatch(setCustomerList(updatedList))

                dispatch(
                    getCustomers({
                        pageIndex: tableData.pageIndex,
                        pageSize: tableData.pageSize,
                        sort: tableData.sort,
                        query: tableData.query,
                        filterData,
                    }),
                )

                toast.push(
                    <Notification title={t('text.actions.save')} type="success">
                        {t(
                            customer?.id
                                ? 'text.messages.customerUpdated'
                                : 'text.messages.customerAdded',
                        )}
                    </Notification>,
                    { placement: 'top-center' },
                )

                onClose()
            } catch (error) {
                const rawMessage =
                    (error as any)?.response?.data?.message ||
                    (error as Error).message
                const translatedMessage = t(rawMessage, {
                    defaultValue: rawMessage,
                })
                toast.push(
                    <Notification title={t('validation.failed')} type="danger">
                        {translatedMessage}
                    </Notification>,
                    { placement: 'top-center' },
                )
                throw error
            }
        }

        const labels = {
            cancel: t('text.actions.cancel'),
            next: t('text.actions.next'),
            save: t('text.actions.save'),
        }

        return (
            <CustomerFormDrawer
                isOpen={isOpen}
                onClose={onClose}
                customer={(customer || {}) as Customer}
                title={t('text.titles.customerInformation')}
                labels={labels}
                onSubmit={handleSubmit}
                activeTab={activeTab}
                onTabChange={onTabChange}
                onAddressCompleteChange={onAddressCompleteChange}
            />
        )
    }
)

CustomerEditContent.displayName = 'CustomerEditContent'

export default CustomerEditContent
