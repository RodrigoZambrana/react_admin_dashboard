import { useRef } from 'react'
import Button from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'
import Drawer from '@/components/ui/Drawer'
import {
    closeEditActivityDialog,
    updateProfileData,
    useAppDispatch,
    useAppSelector,
} from '../store'
import CustomerForm, { FormikRef, FormModel } from '@/views/crm/CustomerForm'
import cloneDeep from 'lodash/cloneDeep'
import dayjs from 'dayjs'

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

const ActivityEditProfile = () => {
    const dispatch = useAppDispatch()

    const formikRef = useRef<FormikRef>(null)

    const dialogOpen = useAppSelector(
        (state) => state.calendarActivityDetails.data.editActivityDialog,
    )
    const activity = useAppSelector(
        (state) => state.calendarActivityDetails.data.profileData,
    )

    const onDrawerClose = () => {
        dispatch(closeEditActivityDialog())
    }

    const formSubmit = () => {
        formikRef.current?.submitForm()
    }

    const onFormSubmit = (values: FormModel) => {
        const clonedData = cloneDeep(activity)
        const {
            name,
            birthday,
            email,
            img,
            location,
            title,
            phoneNumber,
            facebook,
            twitter,
            pinterest,
            linkedIn,
        } = values

        const basicInfo = { name, email, img }
        const personalInfo = {
            location,
            title,
            birthday: dayjs(birthday).format('DD/MM/YYYY'),
            phoneNumber,
            facebook,
            twitter,
            pinterest,
            linkedIn,
        }
        clonedData.personalInfo = {
            ...clonedData.personalInfo,
            ...personalInfo,
        }
        const newData = { ...clonedData, ...basicInfo }
        dispatch(updateProfileData(newData))
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
                customer={activity}
                onFormSubmit={onFormSubmit}
            />
        </Drawer>
    )
}

export default ActivityEditProfile

