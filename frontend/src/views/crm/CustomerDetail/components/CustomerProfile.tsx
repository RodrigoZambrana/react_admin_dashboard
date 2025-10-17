import { useState } from 'react'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { HiPencilAlt, HiOutlineTrash, HiOutlineUser } from 'react-icons/hi'
import { FaWhatsapp } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import {
    deleteCustomer,
    openEditCustomerDetailDialog,
    useAppDispatch,
    Customer,
} from '../store'
import EditCustomerProfile from './EditCustomerProfile'
import { useTranslation } from 'react-i18next'

const CustomerInfoField = ({
    title,
    value,
}: {
    title?: string
    value?: string
}) => {
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

    const handleDelete = async () => {
        setDialogOpen(false)
        if (!id) return
        try {
            await dispatch(deleteCustomer({ id })).unwrap()
            toast.push(
                <Notification
                    title={t('text.titles.customerDeleted')}
                    type="success"
                >
                    {t('text.messages.customerDeleted')}
                </Notification>,
            )
            navigate('/app/crm/customers')
        } catch (error) {
            const responseMessage =
                (typeof error === 'object' &&
                    error !== null &&
                    // @ts-expect-error axios style response
                    (error.response?.data?.message || error.message)) ||
                t('text.messages.customerDeleteHasOrders')
            const translated = t(responseMessage, {
                defaultValue: responseMessage,
            })
            toast.push(
                <Notification
                    title={t('text.titles.deleteCustomerFailed')}
                    type="danger"
                >
                    {translated}
                </Notification>,
            )
        }
    }

    const handleEdit = () => {
        dispatch(openEditCustomerDetailDialog())
    }

    return (
        <>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    icon={<HiOutlineTrash />}
                    onClick={() => setDialogOpen(true)}
                >
                    {t('text.actions.delete')}
                </Button>
                <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    icon={<HiPencilAlt />}
                    variant="solid"
                    onClick={handleEdit}
                >
                    {t('text.actions.edit')}
                </Button>
            </div>
            <ConfirmDialog
                isOpen={dialogOpen}
                type="danger"
                title={t('text.titles.deleteCustomer')}
                confirmButtonColor="red-600"
                onClose={() => setDialogOpen(false)}
                onRequestClose={() => setDialogOpen(false)}
                onCancel={() => setDialogOpen(false)}
                onConfirm={handleDelete}
            >
                <p>{t('text.messages.deleteCustomerConfirm')}</p>
            </ConfirmDialog>
        </>
    )
}

const CustomerProfile = ({ data = {} }: { data?: Partial<Customer> }) => {
    const { t } = useTranslation()
    const phoneNumbers =
        data.phoneNumbers || data.personalInfo?.phoneNumbers || []
    const phone =
        phoneNumbers[0] ||
        data.phoneNumber ||
        data.personalInfo?.phoneNumber ||
        ''
    const normalizedPhone = phone.replace(/\D+/g, '')
    const whatsAppHref = normalizedPhone ? `https://wa.me/${normalizedPhone}` : ''

    return (
        <Card>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Avatar
                            size={90}
                            shape="circle"
                            src={data.img}
                            icon={<HiOutlineUser />}
                        />
                        <div>
                            <h4 className="font-bold">
                                {[data.firstName, data.lastName]
                                    .filter(Boolean)
                                    .join(' ') || data.name}
                            </h4>
                            {data.role && (
                                <p className="text-sm text-gray-500 dark:text-gray-300">
                                    {data.role}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <CustomerProfileAction id={data.id} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <CustomerInfoField
                        title={t('text.labels.email')}
                        value={data.email}
                    />
                    <div>
                        <span>{t('text.labels.phone')}</span>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="font-semibold">
                                {phone || '-'}
                            </span>
                            {whatsAppHref && (
                                <a
                                    href={whatsAppHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-500 text-xl"
                                    aria-label="WhatsApp"
                                >
                                    <FaWhatsapp />
                                </a>
                            )}
                        </div>
                        {phoneNumbers.slice(1).length > 0 && (
                            <div className="mt-2 flex flex-col gap-1">
                                {phoneNumbers.slice(1).map((extraPhone, index) => (
                                    <span
                                        key={`${extraPhone}-${index}`}
                                        className="text-sm text-gray-600 dark:text-gray-300"
                                    >
                                        {extraPhone}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    {data.personalInfo?.location && (
                        <CustomerInfoField
                            title={t('text.labels.location')}
                            value={data.personalInfo.location}
                        />
                    )}
                </div>
            </div>
            <EditCustomerProfile />
        </Card>
    )
}

export default CustomerProfile
