import { useMemo } from 'react'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { useTranslation } from 'react-i18next'
import type { Customer } from '@/views/crm/CustomerDetail/store'
import {
    HiOutlineMail,
    HiOutlinePhone,
    HiOutlineLocationMarker,
    HiOutlineUser,
} from 'react-icons/hi'
import Button from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

type ActivityCustomerInfoProps = {
    customer?: Partial<Customer>
    isLinked: boolean
    loading?: boolean
}

const ActivityCustomerInfo = ({
    customer,
    isLinked,
    loading = false,
}: ActivityCustomerInfoProps) => {
    const { t } = useTranslation()
    const navigate = useNavigate()

    const primaryAddress = useMemo(() => {
        const addresses = customer?.addresses || []
        const preferred = addresses.find((address) => address?.isPrimary)
        return preferred || addresses[0]
    }, [customer?.addresses])

    const phones = useMemo(() => {
        const values = [
            ...(customer?.phoneNumbers || []),
            ...(customer?.personalInfo?.phoneNumbers || []),
            customer?.phoneNumber,
            customer?.personalInfo?.phoneNumber,
        ].filter((value): value is string => Boolean(value && value.trim().length))
        const uniqueValues = Array.from(new Set(values))
        return uniqueValues
    }, [
        customer?.personalInfo?.phoneNumber,
        customer?.personalInfo?.phoneNumbers,
        customer?.phoneNumber,
        customer?.phoneNumbers,
    ])

    const addressLines = useMemo(() => {
        if (!primaryAddress) {
            return []
        }
        const streetParts = [primaryAddress.street, primaryAddress.number]
            .map((value) => (value ? String(value).trim() : ''))
            .filter((value) => value.length)
        const apartment = primaryAddress.apartment ? String(primaryAddress.apartment).trim() : ''
        const streetLine = [streetParts.join(' '), apartment ? `Apt ${apartment}` : '']
            .filter((value) => value.length)
            .join(' ')
            .trim()
        const cornerLine =
            primaryAddress.corner && String(primaryAddress.corner).trim().length
                ? t('text.labels.cornerFormat', {
                      defaultValue: `esquina ${primaryAddress.corner}`,
                      corner: primaryAddress.corner,
                  })
                : ''
        const locality = [primaryAddress.city, primaryAddress.country]
            .map((value) => (value ? String(value).trim() : ''))
            .filter((value) => value.length)
            .join(', ')
        return [streetLine, cornerLine, locality].filter((value) => value && value.trim().length)
    }, [primaryAddress, t])

    const formattedAddress = addressLines.join('\n')

    if (loading) {
        return (
            <Card>
                <div className="flex flex-col gap-3 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
            </Card>
        )
    }

    if (!isLinked) {
        return (
            <Card>
                <div className="flex flex-col gap-4">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {t('calendar.fields.customer', {
                            defaultValue: 'Cliente asociado (opcional)',
                        })}
                    </h4>
                    <span className="text-gray-600 dark:text-gray-300">
                        {t('calendar.messages.noLinkedCustomer', {
                            defaultValue: 'Sin cliente asociado.',
                        })}
                    </span>
                </div>
            </Card>
        )
    }

    if (!customer || !customer.id) {
        return (
            <Card>
                <div className="flex flex-col gap-4">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {t('calendar.fields.customer', {
                            defaultValue: 'Cliente asociado (opcional)',
                        })}
                    </h4>
                    <span className="text-gray-600 dark:text-gray-300">
                        {t('calendar.messages.customerNotFound', {
                            defaultValue: 'No se encontró información del cliente.',
                        })}
                    </span>
                </div>
            </Card>
        )
    }

    const fullName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()

    return (
        <Card>
            <div className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                    <Avatar
                        size={64}
                        shape="circle"
                        src={customer.img}
                        icon={<HiOutlineUser />}
                    />
                    <div className="flex flex-col">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {fullName || customer.name ||
                                t('text.labels.name', { defaultValue: 'Nombre' })}
                        </h4>
                        {customer.role && (
                            <span className="text-sm text-gray-500 dark:text-gray-300">
                                {customer.role}
                            </span>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/75 dark:bg-gray-800/60 backdrop-blur px-4 py-3 shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="mt-1 text-primary-600 dark:text-primary-400">
                                <HiOutlineMail className="h-5 w-5" />
                            </span>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {t('text.labels.email', { defaultValue: 'Correo' })}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {customer.email || '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/75 dark:bg-gray-800/60 backdrop-blur px-4 py-3 shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="mt-1 text-primary-600 dark:text-primary-400">
                                <HiOutlinePhone className="h-5 w-5" />
                            </span>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {t('text.labels.phone', { defaultValue: 'Teléfono' })}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {phones.length ? phones.join(', ') : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/75 dark:bg-gray-800/60 backdrop-blur px-4 py-3 shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="mt-1 text-primary-600 dark:text-primary-400">
                                <HiOutlineLocationMarker className="h-5 w-5" />
                            </span>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {t('calendar.labels.address', {
                                        defaultValue: 'Dirección',
                                    })}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-pre-line">
                                    {formattedAddress.trim() ||
                                        customer.personalInfo?.location ||
                                        '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        variant="solid"
                        disabled={!customer.id}
                        onClick={() => {
                            if (customer.id) {
                                navigate(`/app/crm/customer-details?id=${customer.id}`)
                            }
                        }}
                    >
                        {t('text.actions.view', { defaultValue: 'Ver' })}
                    </Button>
                </div>
            </div>
        </Card>
    )
}

export default ActivityCustomerInfo
