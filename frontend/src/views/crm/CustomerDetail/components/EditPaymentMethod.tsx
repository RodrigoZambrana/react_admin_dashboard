import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import { FormItem, FormContainer } from '@/components/ui/Form'
import { Field, Form, Formik, FieldProps } from 'formik'
import {
    updatePaymentMethodData,
    closeEditPaymentMethodDialog,
    useAppDispatch,
    useAppSelector,
    PaymentMethod,
} from '../store'
import cloneDeep from 'lodash/cloneDeep'
import FormCustomFormatInput from '@/components/shared/FormCustomFormatInput'
import FormPatternInput from '@/components/shared/FormPatternInput'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'

type FormModel = {
    cardHolderName: string
    ccNumber: string
    cardExpiry: string
    code: string
}

const validationSchema = Yup.object().shape({
    cardHolderName: Yup.string().required('Card holder name required'),
    ccNumber: Yup.string()
        .required('Credit card number required')
        .matches(
            /^(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/,
            'Invalid credit card number',
        ),
    cardExpiry: Yup.string()
        .required('Card holder name required')
        .matches(/^(0[1-9]|1[0-2])\/?([0-9]{4}|[0-9]{2})$/, 'Invalid Date'),
    code: Yup.string()
        .required()
        .matches(/^[0-9]{3}$/, 'Invalid CVV'),
})

function limit(val: string, max: string) {
    if (val.length === 1 && val[0] > max[0]) {
        val = '0' + val
    }

    if (val.length === 2) {
        if (Number(val) === 0) {
            val = '01'
        } else if (val > max) {
            val = max
        }
    }

    return val
}

function cardExpiryFormat(val: string) {
    const month = limit(val.substring(0, 2), '12')
    const date = limit(val.substring(2, 4), '31')

    return month + (date.length ? '/' + date : '')
}

const EditPaymentMethod = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const EMPTY_METHODS: PaymentMethod[] = []
    const EMPTY_SELECTED: Partial<PaymentMethod> = {}
    const crmDetails = useAppSelector(
        (state) => state.crmCustomerDetails?.data,
    )
    const card = (crmDetails?.selectedCard as Partial<PaymentMethod>) ?? EMPTY_SELECTED
    const data = crmDetails?.paymentMethodData ?? EMPTY_METHODS
    const dialogOpen = crmDetails?.editPaymentMethodDialog ?? false
    const selectedCard = (crmDetails?.selectedCard as Partial<PaymentMethod>) ?? EMPTY_SELECTED

    const onUpdateCreditCard = (values: FormModel) => {
        let newData = cloneDeep(data) || []
        const { cardHolderName, ccNumber, cardExpiry } = values

        const updatedCard = {
            cardHolderName,
            last4Number: ccNumber.substr(ccNumber.length - 4),
            expYear: cardExpiry.substr(cardExpiry.length - 2),
            expMonth: cardExpiry.substring(0, 2),
        }

        newData = newData.map((payment) => {
            if (payment.last4Number === selectedCard.last4Number) {
                payment = { ...payment, ...updatedCard }
            }
            return payment
        })

        onDialogClose()
        dispatch(updatePaymentMethodData(newData))
    }
    const onDialogClose = () => {
        dispatch(closeEditPaymentMethodDialog())
    }

    return (
        <Dialog
            isOpen={dialogOpen}
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
        >
            <h4>{t('text.titles.editCreditCard')}</h4>
            <div className="mt-6">
                <Formik
                    initialValues={{
                        cardHolderName: (card as any)?.cardHolderName || '',
                        ccNumber: '',
                        cardExpiry:
                            ((card as any)?.expMonth ? String((card as any).expMonth) : '') +
                            ((card as any)?.expYear ? String((card as any).expYear) : ''),
                        code: '',
                    }}
                    validationSchema={validationSchema}
                    onSubmit={(values, { setSubmitting }) => {
                        onUpdateCreditCard(values)
                        setSubmitting(false)
                    }}
                >
                    {({ touched, errors }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    label={t('text.labels.cardHolderName')}
                                    invalid={
                                        errors.cardHolderName &&
                                        touched.cardHolderName
                                    }
                                    errorMessage={errors.cardHolderName}
                                >
                                    <Field
                                        type="text"
                                        autoComplete="off"
                                        name="cardHolderName"
                                        component={Input}
                                    />
                                </FormItem>
                                <FormItem
                                    label={t('text.labels.creditCardNumber')}
                                    invalid={
                                        errors.ccNumber && touched.ccNumber
                                    }
                                    errorMessage={errors.ccNumber}
                                >
                                    <Field name="ccNumber">
                                        {({ field, form }: FieldProps) => {
                                            return (
                                                <FormPatternInput
                                                    form={form}
                                                    field={field}
                                                    placeholder="•••• •••• •••• ••••"
                                                    format="#### #### #### ####"
                                                    onValueChange={(e) => {
                                                        form.setFieldValue(
                                                            field.name,
                                                            e.value,
                                                        )
                                                    }}
                                                />
                                            )
                                        }}
                                    </Field>
                                </FormItem>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormItem
                                        label={t('text.labels.expirationDate')}
                                        invalid={
                                            errors.cardExpiry &&
                                            touched.cardExpiry
                                        }
                                        errorMessage={errors.cardExpiry}
                                    >
                                        <Field name="cardExpiry">
                                            {({ field, form }: FieldProps) => {
                                                return (
                                                    <FormCustomFormatInput
                                                        form={form}
                                                        field={field}
                                                        placeholder="••/••"
                                                        format={
                                                            cardExpiryFormat
                                                        }
                                                        defaultValue={
                                                            form.values
                                                                .cardExpiry
                                                        }
                                                        onValueChange={(e) => {
                                                            form.setFieldValue(
                                                                field.name,
                                                                e.value,
                                                            )
                                                        }}
                                                    />
                                                )
                                            }}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        label={t('text.labels.cvv')}
                                        invalid={errors.code && touched.code}
                                        errorMessage={errors.code}
                                    >
                                        <Field name="code">
                                            {({ field, form }: FieldProps) => {
                                                return (
                                                    <FormPatternInput
                                                        form={form}
                                                        field={field}
                                                        placeholder="•••"
                                                        format="###"
                                                        onValueChange={(e) => {
                                                            form.setFieldValue(
                                                                field.name,
                                                                e.value,
                                                            )
                                                        }}
                                                    />
                                                )
                                            }}
                                        </Field>
                                    </FormItem>
                                </div>
                                <FormItem className="mb-0 text-right">
                                    <Button block variant="solid" type="submit">
                                        {t('text.actions.update')}
                                    </Button>
                                </FormItem>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </div>
        </Dialog>
    )
}

export default EditPaymentMethod
