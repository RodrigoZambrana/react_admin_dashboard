import { useEffect, useState } from 'react'
import CustomerEditContent from './CustomerEditContent'
import {
    setDrawerClose,
    setSelectedCustomer,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { apiGetCrmCustomerDetails } from '@/services/CrmService'
import type { Customer } from '../store'

const CustomerEditDialog = () => {
    const dispatch = useAppDispatch()
    const drawerOpen = useAppSelector(
        (state) => state.crmCustomers.data.drawerOpen,
    )
    const selectedCustomer = useAppSelector(
        (state) => state.crmCustomers.data.selectedCustomer,
    )

    const onDrawerClose = () => {
        dispatch(setDrawerClose())
        dispatch(setSelectedCustomer({}))
    }

    const [activeTab, setActiveTab] = useState<'personalInfo' | 'address'>('personalInfo')
    const [customerDetail, setCustomerDetail] = useState<Partial<Customer> | null>(
        null,
    )

    useEffect(() => {
        const loadDetail = async () => {
            if (!drawerOpen) {
                setCustomerDetail(null)
                return
            }
            const rawId = selectedCustomer?.id
            if (!rawId) {
                setCustomerDetail(null)
                return
            }
            const numericId = Number(rawId)
            if (!Number.isFinite(numericId)) {
                setCustomerDetail(selectedCustomer)
                return
            }
            try {
                const response = await apiGetCrmCustomerDetails<
                    Customer,
                    { id: string }
                >({ id: String(numericId) })
                const detail = (response.data as unknown as Customer) ||
                    ((response as unknown) as Customer)
                setCustomerDetail(detail)
            } catch (error) {
                setCustomerDetail(selectedCustomer)
            }
        }
        loadDetail()
    }, [drawerOpen, selectedCustomer])

    return (
        <CustomerEditContent
            isOpen={drawerOpen}
            onClose={onDrawerClose}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            customerData={customerDetail || selectedCustomer}
        />
    )
}

export default CustomerEditDialog
