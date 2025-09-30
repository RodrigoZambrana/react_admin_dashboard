import Button from '@/components/ui/Button'
import Tag from '@/components/ui/Tag'
import EditPaymentMethod from './EditPaymentMethod'
import DeletePaymentMethod from './DeletePaymentMethod'
import {
    openDeletePaymentMethodDialog,
    openEditPaymentMethodDialog,
    updateSelectedCard,
    useAppDispatch,
    useAppSelector,
    PaymentMethod,
} from '../store'
import isLastChild from '@/utils/isLastChild'
import classNames from 'classnames'
import { HiPencilAlt } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

const monthsKey = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
]

const PaymentMethods = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const EMPTY_METHODS: PaymentMethod[] = []
    const crmDetails = useSelector(
        (state: any) => state.crmCustomerDetails?.data,
    )
    const activityDetails = useSelector(
        (state: any) => state.calendarActivityDetails?.data,
    )
    const isCrm = (crmDetails?.paymentMethodData?.length ?? 0) > 0
    const data = isCrm
        ? (crmDetails?.paymentMethodData as PaymentMethod[])
        : (activityDetails?.paymentMethodData as PaymentMethod[]) ?? EMPTY_METHODS

    const onEditPaymentMethodDialogOpen = (card: PaymentMethod) => {
        if (!isCrm) return
        dispatch(updateSelectedCard(card))
        dispatch(openEditPaymentMethodDialog())
    }

    const onDeletePaymentMethodDialogOpen = (card: PaymentMethod) => {
        if (!isCrm) return
        dispatch(updateSelectedCard(card))
        dispatch(openDeletePaymentMethodDialog())
    }

    return (
        <>
            {data.length > 0 && (
                <div>
                    <h6 className="mb-4">{t('text.titles.paymentMethods')}</h6>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600">
                        {data.map((card, index) => (
                            <div
                                key={card.last4Number}
                                className={classNames(
                                    'flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4',
                                    !isLastChild(data, index) &&
                                        'border-b border-gray-200 dark:border-gray-600',
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {card.cardType === 'VISA' && (
                                        <img
                                            src="/img/others/img-8.png"
                                            alt="visa"
                                        />
                                    )}
                                    {card.cardType === 'MASTER' && (
                                        <img
                                            src="/img/others/img-9.png"
                                            alt="master"
                                        />
                                    )}
                                    <div>
                                        <div className="flex items-center">
                                            <div className="text-gray-900 dark:text-gray-100 font-semibold">
                                                {card.cardHolderName} ••••{' '}
                                                {card.last4Number}
                                            </div>
                                            {card.primary && (
                                                <Tag className="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-100 rounded-md border-0 mx-2">
                                                    <span className="capitalize">{t('text.labels.primary')}</span>
                                                </Tag>
                                            )}
                                        </div>
                                        <span>
                                            {t('text.labels.expired')}{' '}
                                            {t(`text.date.monthsShort.${monthsKey[parseInt(card.expMonth) - 1]}`)} 20{card.expYear}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex">
                                    <Button
                                        className="mr-2 rtl:ml-2"
                                        variant="plain"
                                        size="sm"
                                        disabled={!isCrm}
                                        onClick={() =>
                                            onDeletePaymentMethodDialogOpen(
                                                card,
                                            )
                                        }
                                    >
                                        {t('text.actions.delete')}
                                    </Button>
                                    <Button
                                        icon={<HiPencilAlt />}
                                        size="sm"
                                        disabled={!isCrm}
                                        onClick={() =>
                                            onEditPaymentMethodDialogOpen(card)
                                        }
                                    >
                                        {t('text.actions.edit')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <EditPaymentMethod />
            <DeletePaymentMethod />
        </>
    )
}

export default PaymentMethods
