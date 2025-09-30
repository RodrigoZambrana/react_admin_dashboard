import { useRef } from 'react'
import Button from '@/components/ui/Button'
import Drawer from '@/components/ui/Drawer'
import CustomerEditContent, { FormikRef } from './CustomerEditContent'
import {
    setDrawerClose,
    setSelectedCustomer,
    useAppDispatch,
    useAppSelector,
} from '../store'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

type DrawerFooterProps = {
    onSaveClick: (event: MouseEvent<HTMLButtonElement>) => void
    onCancel: (event: MouseEvent<HTMLButtonElement>) => void
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

const CustomerEditDialog = () => {
    const dispatch = useAppDispatch()
    const drawerOpen = useAppSelector(
        (state) => state.crmCustomers.data.drawerOpen,
    )

    const onDrawerClose = () => {
        dispatch(setDrawerClose())
        dispatch(setSelectedCustomer({}))
    }

    const formikRef = useRef<FormikRef>(null)

    const formSubmit = () => {
        formikRef.current?.submitForm()
    }

    return (
        <Drawer
            isOpen={drawerOpen}
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
            <CustomerEditContent ref={formikRef} />
        </Drawer>
    )
}

export default CustomerEditDialog
