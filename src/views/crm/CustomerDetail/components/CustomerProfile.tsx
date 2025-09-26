import { useState } from 'react'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import {
    FaFacebookF,
    FaTwitter,
    FaLinkedinIn,
    FaPinterestP,
} from 'react-icons/fa'
import { HiPencilAlt, HiOutlineTrash } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import {
    deleteCustomer,
    openEditCustomerDetailDialog,
    useAppDispatch,
    Customer,
} from '../store'
import EditCustomerProfile from './EditCustomerProfile'
import { useTranslation } from 'react-i18next'

type CustomerInfoFieldProps = {
    title?: string
    value?: string
}

type CustomerProfileProps = {
    data?: Partial<Customer>
}

const CustomerInfoField = ({ title, value }: CustomerInfoFieldProps) => {
    return (
        <div>
            <span>{title}</span>
            <p className="text-gray-700 dark:text-gray-200 font-semibold">
                {value}
            </p>
        </div>
    )
}

const CustomerProfileAction = ({ id }: { id?: string }) => {
    const dispatch = useAppDispatch()
    const [dialogOpen, setDialogOpen] = useState(false)

    const navigate = useNavigate()
    const { t } = useTranslation()

    const onDialogClose = () => {
        setDialogOpen(false)
    }

    const onDialogOpen = () => {
        setDialogOpen(true)
    }

    const onDelete = () => {
        setDialogOpen(false)
        if (id) {
            dispatch(deleteCustomer({ id }))
        }
        navigate('/app/crm/customers')
        toast.push(
            <Notification title={t('text.titles.customerDeleted')} type="success">
                {t('text.messages.customerDeleted')}
            </Notification>,
        )
    }

    const onEdit = () => {
        dispatch(openEditCustomerDetailDialog())
    }

    return (
        <>
            <Button block icon={<HiOutlineTrash />} onClick={onDialogOpen}>
                {t('text.actions.delete')}
            </Button>
            <Button
                block
                icon={<HiPencilAlt />}
                variant="solid"
                onClick={onEdit}
            >
                {t('text.actions.edit')}
            </Button>
            <ConfirmDialog
                isOpen={dialogOpen}
                type="danger"
                title={t('text.titles.deleteCustomer')}
                confirmButtonColor="red-600"
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
                onCancel={onDialogClose}
                onConfirm={onDelete}
            >
                <p>{t('text.messages.deleteCustomerConfirm')}</p>
            </ConfirmDialog>
            <EditCustomerProfile />
        </>
    )
}

const CustomerProfile = ({ data = {} }: CustomerProfileProps) => {
    const { t } = useTranslation()
    return (
        <Card>
            <div className="flex flex-col xl:justify-between h-full 2xl:min-w-[360px] mx-auto">
                <div className="flex xl:flex-col items-center gap-4">
                    <Avatar size={90} shape="circle" src={data.img} />
                    <h4 className="font-bold">{data.name}</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-y-7 gap-x-4 mt-8">
                    <CustomerInfoField title={t('text.labels.email')} value={data.email} />
                    <CustomerInfoField
                        title={t('text.labels.phone')}
                        value={data.personalInfo?.phoneNumber}
                    />
                    <CustomerInfoField
                        title={t('text.labels.location')}
                        value={data.personalInfo?.location}
                    />
                    <CustomerInfoField
                        title={t('text.labels.dateOfBirth')}
                        value={data.personalInfo?.birthday}
                    />
                    <CustomerInfoField
                        title={t('text.labels.title')}
                        value={data.personalInfo?.title}
                    />
                    <div className="mb-7">
                        <span>{t('text.labels.social')}</span>
                        <div className="flex mt-4">
                            <Button
                                className="mr-2"
                                shape="circle"
                                size="sm"
                                icon={
                                    <FaFacebookF className="text-[#1773ea]" />
                                }
                            />
                            <Button
                                className="mr-2"
                                shape="circle"
                                size="sm"
                                icon={<FaTwitter className="text-[#1da1f3]" />}
                            />
                            <Button
                                className="mr-2"
                                shape="circle"
                                size="sm"
                                icon={
                                    <FaLinkedinIn className="text-[#0077b5]" />
                                }
                            />
                            <Button
                                className="mr-2"
                                shape="circle"
                                size="sm"
                                icon={
                                    <FaPinterestP className="text-[#df0018]" />
                                }
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex flex-col xl:flex-row gap-2">
                    <CustomerProfileAction id={data.id} />
                </div>
            </div>
        </Card>
    )
}

export default CustomerProfile
