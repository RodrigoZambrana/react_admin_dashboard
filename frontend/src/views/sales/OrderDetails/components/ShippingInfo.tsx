import { useMemo } from 'react'
import dayjs from 'dayjs'
import Avatar from '@/components/ui/Avatar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { NumericFormat } from 'react-number-format'
import { useTranslation } from 'react-i18next'

type ShippingInfoProps = {
    data?: {
        deliveryFees: number
        estimatedMin: number
        estimatedMax: number
        shippingLogo: string
        shippingVendor: string
    }
    estimatedDate?: string | null
    onEdit?: () => void
}

const ShippingInfo = ({ data, estimatedDate, onEdit }: ShippingInfoProps) => {
    const { t } = useTranslation()
    const estimatedDateLabel = useMemo(() => {
        if (!estimatedDate) {
            return null
        }
        const parsed = dayjs(estimatedDate)
        return parsed.isValid() ? parsed.format('DD MMM YYYY') : null
    }, [estimatedDate])

    return (
        <Card className="mb-4">
            <h5 className="mb-4">{t('text.titles.shipping')}</h5>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <Avatar size={60} src={data?.shippingLogo} />
                    <div className="ltr:ml-2 rtl:mr-2">
                        <h6>{data?.shippingVendor}</h6>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            {t('text.labels.deliveryIn')} {data?.estimatedMin} ~ {data?.estimatedMax}{' '}
                            {t('text.labels.days')}
                        </div>
                        {estimatedDateLabel && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {t('text.labels.estimatedDelivery')}: {estimatedDateLabel}
                            </div>
                        )}
                    </div>
                </div>
                <span className="font-semibold">
                    <NumericFormat
                        displayType="text"
                        value={(
                            Math.round((data?.deliveryFees || 0) * 100) / 100
                        ).toFixed(2)}
                        prefix={'$'}
                        thousandSeparator={true}
                    />
                </span>
            </div>
            <Button block onClick={() => onEdit?.()}>
                {t('text.actions.editDeliveryInformation')}
            </Button>
        </Card>
    )
}

export default ShippingInfo
