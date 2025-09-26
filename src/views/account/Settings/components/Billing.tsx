import { useState, useEffect } from 'react'
import classNames from 'classnames'
import Tag from '@/components/ui/Tag'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { FormContainer } from '@/components/ui/Form'
import Dialog from '@/components/ui/Dialog'
import FormDesription from './FormDesription'
import FormRow from './FormRow'
import CreditCardForm, { CreditCardInfo } from './CreditCardForm'
import BillingHistory from './BillingHistory'
import { Field, Form, Formik } from 'formik'
import { HiPlus } from 'react-icons/hi'
import isLastChild from '@/utils/isLastChild'
import { apiGetAccountSettingBillingData } from '@/services/AccountServices'
import { useTranslation } from 'react-i18next'
import type { FieldProps, FieldInputProps, FormikProps } from 'formik'

type CreditCard = {
    cardId: string
    cardHolderName: string
    cardType: string
    expMonth: string
    expYear: string
    last4Number: string
    primary: boolean
}

type OtherPayemnt = {
    id: string
    identifier: string
    redirect: string
    type: string
}

type Bill = {
    id: string
    item: string
    status: string
    amount: number
    date: number
}

type BillingData = {
    paymentMethods: CreditCard[]
    otherMethod: OtherPayemnt[]
    billingHistory: Bill[]
}

type BillingFormModel = BillingData

type GetAccountSettingBillingDataResponse = BillingData

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

const Billing = () => {
    const [data, setData] = useState<BillingData>({
        paymentMethods: [],
        otherMethod: [],
        billingHistory: [],
    })
    const [selectedCard, setSelectedCard] = useState<Partial<CreditCardInfo>>(
        {},
    )
    const [ccDialogType, setCcDialogType] = useState<'NEW' | 'EDIT' | ''>('')

    const fetchData = async () => {
        const response =
            await apiGetAccountSettingBillingData<GetAccountSettingBillingDataResponse>()
        setData(response.data)
    }

    const { t } = useTranslation()

    const onFormSubmit = (
        _: BillingFormModel,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        toast.push(
            <Notification
                title={t('text.messages.billingUpdated')}
                type="success"
            />,
            {
                placement: 'top-center',
            },
        )
        setSubmitting(false)
    }

    const onCreditCardDialogClose = () => {
        setCcDialogType('')
        setSelectedCard({})
    }

    const onEditCreditCard = (
        card: Partial<CreditCard>,
        type: 'EDIT' | 'NEW',
    ) => {
        setCcDialogType(type)
        setSelectedCard(card)
    }

    const onCardUpdate = (
        cardValue: CreditCardInfo,
        form: FormikProps<BillingData>,
        field: FieldInputProps<BillingData>,
    ) => {
        let paymentMethodsValue = form.values[
            field.name as keyof BillingData
        ] as CreditCard[]

        if (cardValue.primary) {
            paymentMethodsValue.forEach((card) => {
                card.primary = false
            })
        }

        if (
            !paymentMethodsValue.some(
                (card) => card.cardId === cardValue.cardId,
            )
        ) {
            paymentMethodsValue.push(cardValue)
        }

        paymentMethodsValue = paymentMethodsValue.map((card) => {
            if (card.cardId === cardValue.cardId) {
                card = { ...card, ...cardValue }
            }
            return card
        })

        let cardTemp = {}
        paymentMethodsValue = paymentMethodsValue.filter((card) => {
            if (card.primary) {
                cardTemp = card
            }
            return !card.primary
        })
        paymentMethodsValue = [
            ...[cardTemp as CreditCard],
            ...paymentMethodsValue,
        ]
        form.setFieldValue(field.name, paymentMethodsValue)
        onCreditCardDialogClose()
    }

    const onRedirect = (url: string) => {
        const win = window.open(url, '_blank')
        win?.focus()
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Formik
            enableReinitialize
            initialValues={data}
            onSubmit={(values, { setSubmitting }) => {
                setSubmitting(true)
                setTimeout(() => {
                    onFormSubmit(values, setSubmitting)
                }, 1000)
            }}
        >
            {({ values, touched, errors, isSubmitting, resetForm }) => {
                const validatorProps = { touched, errors }
                return (
                    <Form>
                        <FormContainer>
                            <FormDesription
                                title={t('account.settings.billing.paymentMethod')}
                                desc={t('account.settings.billing.paymentMethodDesc')}
                            />
                            <FormRow
                                name="paymentMethods"
                                alignCenter={false}
                                label={t('account.settings.billing.creditCards')}
                                {...validatorProps}
                            >
                                <div className="rounded-lg border border-gray-200 dark:border-gray-600">
                                    {values?.paymentMethods?.map(
                                        (card, index) => (
                                            <div
                                                key={card.cardId}
                                                className={classNames(
                                                    'flex items-center justify-between p-4',
                                                    !isLastChild(
                                                        values.paymentMethods,
                                                        index,
                                                    ) &&
                                                        'border-b border-gray-200 dark:border-gray-600',
                                                )}
                                            >
                                                <div className="flex items-center">
                                                    {card.cardType ===
                                                        'VISA' && (
                                                        <img
                                                            src="/img/others/img-8.png"
                                                            alt="visa"
                                                        />
                                                    )}
                                                    {card.cardType ===
                                                        'MASTER' && (
                                                        <img
                                                            src="/img/others/img-9.png"
                                                            alt="master"
                                                        />
                                                    )}
                                                    <div className="ml-3 rtl:mr-3">
                                                        <div className="flex items-center">
                                                            <div className="text-gray-900 dark:text-gray-100 font-semibold">
                                                                {
                                                                    card.cardHolderName
                                                                }{' '}
                                                                ••••{' '}
                                                                {
                                                                    card.last4Number
                                                                }
                                                            </div>
                                                            {card.primary && (
                                                                <Tag className="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-100 rounded-md border-0 mx-2">
                                                                    <span className="capitalize">
                                                                        {t('text.labels.primary')}
                                                                    </span>
                                                                </Tag>
                                                            )}
                                                        </div>
                                                        <span>
                                                            {t('text.labels.expired')}{' '}
                                                            {t(
                                                                `date.monthsShort.${
                                                                    monthsKey[
                                                                        parseInt(
                                                                            card.expMonth,
                                                                        ) - 1
                                                                    ]
                                                                }`,
                                                            )}{' '}
                                                            20
                                                            {card.expYear}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex">
                                                    <Button
                                                        size="sm"
                                                        type="button"
                                                        onClick={() =>
                                                            onEditCreditCard(
                                                                card,
                                                                'EDIT',
                                                            )
                                                        }
                                                    >
                                                        {t('text.actions.edit')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>
                                <div className="mt-2">
                                    <Button
                                        type="button"
                                        variant="plain"
                                        size="sm"
                                        icon={<HiPlus className="text-lg" />}
                                        onClick={() =>
                                            onEditCreditCard({}, 'NEW')
                                        }
                                    >
                                        <span className="font-semibold">
                                            {t('text.actions.addNewCard')}
                                        </span>
                                    </Button>
                                </div>
                            </FormRow>
                            <FormRow
                                border={false}
                                name="otherMethod"
                                alignCenter={false}
                                label={t('text.labels.otherPaymentMethods')}
                                {...validatorProps}
                            >
                                <div className="rounded-lg border border-gray-200 dark:border-gray-600">
                                    {values?.otherMethod?.map(
                                        (method, index) => (
                                            <div
                                                key={method.id}
                                                className={classNames(
                                                    'flex items-center justify-between p-4',
                                                    !isLastChild(
                                                        values.otherMethod,
                                                        index,
                                                    ) &&
                                                        'border-b border-gray-200 dark:border-gray-600',
                                                )}
                                            >
                                                <div className="flex items-center">
                                                    {method.type ===
                                                        'PAYPAL' && (
                                                        <img
                                                            src="/img/others/img-10.png"
                                                            alt="visa"
                                                        />
                                                    )}
                                                    <div className="ml-3 rtl:mr-3 font-semibold">
                                                        {method.identifier}
                                                    </div>
                                                </div>
                                                <div className="flex">
                                                    <Button
                                                        size="sm"
                                                        type="button"
                                                        onClick={() =>
                                                            onRedirect(
                                                                method.redirect,
                                                            )
                                                        }
                                                    >{t('text.actions.edit')}</Button>
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>
                            </FormRow>
                            <Dialog
                                isOpen={
                                    ccDialogType === 'NEW' ||
                                    ccDialogType === 'EDIT'
                                }
                                onClose={onCreditCardDialogClose}
                                onRequestClose={onCreditCardDialogClose}
                            >
                                <h5 className="mb-4">{t('text.titles.editCreditCard')}</h5>
                                <Field name="paymentMethods">
                                    {({
                                        field,
                                        form,
                                    }: FieldProps<BillingFormModel>) => {
                                        return (
                                            <CreditCardForm
                                                type={ccDialogType}
                                                card={
                                                    selectedCard as CreditCardInfo
                                                }
                                                onUpdate={(cardValue) =>
                                                    onCardUpdate(
                                                        cardValue,
                                                        form,
                                                        field,
                                                    )
                                                }
                                            />
                                        )
                                    }}
                                </Field>
                            </Dialog>
                            <div className="mt-4 ltr:text-right">
                                <Button
                                    className="ltr:mr-2 rtl:ml-2"
                                    type="button"
                                    onClick={() => resetForm()}
                                >
                                    {t('text.actions.reset')}
                                </Button>
                                <Button
                                    variant="solid"
                                    loading={isSubmitting}
                                    type="submit"
                                >
                                    {isSubmitting
                                        ? t('text.actions.updating')
                                        : t('text.actions.update')}
                                </Button>
                            </div>
                            <FormDesription
                                className="mt-6"
                                title={t('text.titles.billingHistory')}
                                desc={t('text.descriptions.viewPreviousBilling')}
                            />
                            <BillingHistory
                                className="mt-4 rounded-lg border border-gray-200 dark:border-gray-600"
                                data={data.billingHistory}
                            />
                        </FormContainer>
                    </Form>
                )
            }}
        </Formik>
    )
}

export default Billing
