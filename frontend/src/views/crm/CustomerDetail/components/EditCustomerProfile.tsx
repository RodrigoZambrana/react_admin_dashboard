import { useRef } from 'react'
import Button from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'
import Drawer from '@/components/ui/Drawer'
import {
    closeEditCustomerDetailDialog,
    updateProfileData,
    putCustomer,
    useAppDispatch,
    useAppSelector,
    Customer,
} from '../store'
import CustomerForm, { FormikRef, FormModel } from '@/views/crm/CustomerForm'
import cloneDeep from 'lodash/cloneDeep'

type DrawerFooterProps = {
    onSaveClick?: () => void
    onCancel?: () => void
}

const DrawerFooter = ({ onSaveClick, onCancel }: DrawerFooterProps) => {
    const { t } = useTranslation()
    return (
        <div className="text-right w-full">
            <Button size="sm" className="mr-2" onClick={onCancel}>
                {t('text.actions.cancel')}
            </Button>
            <Button size="sm" variant="solid" onClick={onSaveClick}>
                {t('text.actions.save')}
            </Button>
        </div>
    )
}

const EditCustomerProfile = () => {
    const dispatch = useAppDispatch()

    const formikRef = useRef<FormikRef>(null)

    const dialogOpen = useAppSelector(
        (state) => state.crmCustomerDetails.data.editCustomerDetailDialog,
    )
    const customer = useAppSelector(
        (state) => state.crmCustomerDetails.data.profileData,
    )

    const onDrawerClose = () => {
        dispatch(closeEditCustomerDetailDialog())
    }

    const formSubmit = () => {
        formikRef.current?.submitForm()
    }

    const onFormSubmit = (values: FormModel) => {
        const clonedData = cloneDeep(customer)
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
            phoneNumbers,
            address,
        } = values

        const name = [firstName, lastName].filter(Boolean).join(' ')
        const sanitizedPhones = (phoneNumbers || [])
            .map((phone) => phone.trim())
            .filter((phone) => phone.length > 0)
        const primaryPhone = sanitizedPhones[0] || phoneNumber || ''

        const basicInfo = { name, firstName, lastName, email, img, phoneNumber: primaryPhone }
        const personalInfo = {
            location,
            phoneNumber: primaryPhone,
            phoneNumbers: sanitizedPhones,
            facebook,
            twitter,
            pinterest,
            linkedIn,
        }
        clonedData.personalInfo = {
            ...(clonedData.personalInfo || {}),
            ...personalInfo,
        }
        clonedData.phoneNumbers = sanitizedPhones
        if (address) {
            clonedData.addresses = [
                {
                    ...(clonedData.addresses?.[0] || {}),
                    street: address.street,
                    number: address.number,
                    corner: address.corner,
                    apartment: address.apartment,
                    city: address.city,
                    country: address.state,
                    countryCode: address.countryCode,
                    isPrimary: true,
                },
            ]
        }
        const newData = { ...clonedData, ...basicInfo }
        newData.phoneNumbers = sanitizedPhones
        dispatch(updateProfileData(newData))
        dispatch(putCustomer(newData as Customer))
        onDrawerClose()
    }

    return (
        <Drawer
            isOpen={dialogOpen}
            closable={false}
            bodyClass="p-0"
            footer={
                <DrawerFooter
                    onCancel={onDrawerClose}
                    onSaveClick={formSubmit}
                />
            }
            onClose={onDrawerClose}
            onRequestClose={onDrawerClose}
        >
            <CustomerForm
                ref={formikRef}
                customer={customer}
                onFormSubmit={onFormSubmit}
            />
        </Drawer>
    )
}

export default EditCustomerProfile
