import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import IconText from '@/components/shared/IconText'
import { HiMail, HiPhone, HiExternalLink, HiOutlineUser } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type CustomerInfoProps = {
    data?: {
        id?: number
        name: string
        email: string
        phone: string
        img: string
        previousOrder: number
        previousBudgets?: number
        shippingAddress: {
            line1: string
            line2: string
            line3: string
            line4: string
        }
        billingAddress: {
            line1: string
            line2: string
            line3: string
            line4: string
        }
    }
}

const normalizeLines = (address?: {
    line1?: string
    line2?: string
    line3?: string
    line4?: string
}) =>
    [
        address?.line1,
        address?.line2,
        address?.line3,
        address?.line4,
    ]
        .map((line) => (typeof line === 'string' ? line.trim() : ''))
        .filter((line) => line.length > 0)

const CustomerInfo = ({ data }: CustomerInfoProps) => {
    const { t } = useTranslation()
    const shippingLines = normalizeLines(data?.shippingAddress)
    const billingLines = normalizeLines(data?.billingAddress)
    const previousOrders = data?.previousOrder ?? 0
    const previousBudgets = data?.previousBudgets ?? 0
    return (
        <Card>
            <h5 className="mb-4">{t('text.columns.customer')}</h5>
            <Link
                className="group flex items-center justify-between"
                to={data?.id ? `/app/crm/customer-details?id=${data.id}` : '#'}
            >
                <div className="flex items-center">
                    <Avatar shape="circle" src={data?.img || undefined} icon={<HiOutlineUser />} />
                    <div className="ltr:ml-2 rtl:mr-2">
                        <div className="font-semibold group-hover:text-gray-900 dark:group-hover:text-gray-100">
                            {data?.name}
                        </div>
                        <div className="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                            <span>
                                <span className="font-semibold text-base text-gray-900 dark:text-gray-100">
                                    {previousOrders}{' '}
                                </span>
                                {t('text.labels.previousOrders')}
                            </span>
                            <span>
                                <span className="font-semibold text-base text-gray-900 dark:text-gray-100">
                                    {previousBudgets}{' '}
                                </span>
                                {t('text.labels.previousBudgets')}
                            </span>
                        </div>
                    </div>
                </div>
                <HiExternalLink className="text-xl hidden group-hover:block" />
            </Link>
            <hr className="my-5" />
            <IconText
                className="mb-4"
                icon={<HiMail className="text-xl opacity-70" />}
            >
                <span className="font-semibold">{data?.email}</span>
            </IconText>
            <IconText icon={<HiPhone className="text-xl opacity-70" />}>
                <span className="font-semibold">{data?.phone}</span>
            </IconText>
            <hr className="my-5" />
            <h6 className="mb-4">{t('text.titles.shippingAddress')}</h6>
            <address className="not-italic space-y-1">
                {shippingLines.length > 0 ? (
                    shippingLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))
                ) : (
                    <div>—</div>
                )}
            </address>
            <hr className="my-5" />
            <h6 className="mb-4">{t('text.titles.billingAddress')}</h6>
            <address className="not-italic space-y-1">
                {billingLines.length > 0 ? (
                    billingLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))
                ) : (
                    <div>—</div>
                )}
            </address>
        </Card>
    )
}

export default CustomerInfo
