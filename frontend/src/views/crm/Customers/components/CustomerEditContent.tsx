import { forwardRef } from 'react'
import {
    setCustomerList,
    putCustomer,
    setDrawerClose,
    useAppDispatch,
    useAppSelector,
    Customer,
} from '../store'
import cloneDeep from 'lodash/cloneDeep'
import isEmpty from 'lodash/isEmpty'
import CustomerForm, { FormikRef, FormModel } from '@/views/crm/CustomerForm'
import dayjs from 'dayjs'

const CustomerEditContent = forwardRef<FormikRef>((_, ref) => {
    const dispatch = useAppDispatch()

    const customer = useAppSelector(
        (state) => state.crmCustomers.data.selectedCustomer,
    )
    const data = useAppSelector((state) => state.crmCustomers.data.customerList)
    const { id } = customer

    const onFormSubmit = (values: FormModel) => {
        const {
            firstName,
            lastName,
            email,
            img,
            location,
            phoneNumber,
            facebook,
            twitter,
            pinterest,
            linkedIn,
        } = values

        const name = [firstName, lastName].filter(Boolean).join(' ')
        const basicInfo = { name, firstName, lastName, email, img, phoneNumber }
        const personalInfo = {
            location,
            phoneNumber,
            facebook,
            twitter,
            pinterest,
            linkedIn,
        }
        let newData = cloneDeep(data)
        if (id) {
            let editedCustomer: Partial<Customer> = {}
            newData = newData.map((elm) => {
                if (elm.id === id) {
                    elm = { ...elm, ...basicInfo }
                    elm.personalInfo = { ...elm.personalInfo, ...personalInfo }
                    editedCustomer = elm
                }
                return elm
            })
            if (!isEmpty(editedCustomer)) {
                dispatch(putCustomer(editedCustomer as Customer))
            }
        } else {
            const newCustomer: Customer = {
                id: String(Date.now()),
                name: basicInfo.name || '',
                firstName: firstName || '',
                lastName: lastName || '',
                email: basicInfo.email || '',
                img: basicInfo.img || '/img/avatars/thumb-1.jpg',
                role: 'User',
                lastOnline: dayjs().unix(),
                status: 'active',
                phoneNumber: personalInfo.phoneNumber || '',
                personalInfo: {
                    location: personalInfo.location || '',
                    phoneNumber: personalInfo.phoneNumber || '',
                    facebook: personalInfo.facebook || '',
                    twitter: personalInfo.twitter || '',
                    pinterest: personalInfo.pinterest || '',
                    linkedIn: personalInfo.linkedIn || '',
                },
                orderHistory: [],
                paymentMethod: [],
                subscription: [],
            }
            newData = [newCustomer, ...newData]
        }
        dispatch(setCustomerList(newData))
        dispatch(setDrawerClose())
    }

    return (
        <CustomerForm
            ref={ref}
            customer={customer}
            onFormSubmit={onFormSubmit}
        />
    )
})

CustomerEditContent.displayName = 'CustomerEditContent'

export type { FormikRef }

export default CustomerEditContent
