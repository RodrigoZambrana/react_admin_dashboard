import { useCallback } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import Select from '@/components/ui/Select'
import { FormItem, FormContainer } from '@/components/ui/Form'
import { Field, Form, Formik } from 'formik'
import get from 'lodash/get'
import { countryList } from '@/constants/countries.constant'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import type { Address } from '../store'
import type { FieldProps, FormikTouched, FormikErrors } from 'formik'

type FormModel = Address

type AddressInfomationProps = {
    data: Address
    onNextChange?: (
        values: FormModel,
        formName: string,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => void
    onBackChange?: () => void
    currentStepStatus?: string
}

type AddressFormProps = {
    values: FormModel
    touched: FormikTouched<FormModel>
    errors: FormikErrors<FormModel>
    countryName: string
    addressLine1Name: string
    addressLine2Name: string
    cityName: string
    stateName: string
    zipCodeName: string
}

const validationSchema = Yup.object().shape({
    country: Yup.string().required('Please select country'),
    addressLine1: Yup.string().required('Please enter your address'),
    addressLine2: Yup.string(),
    city: Yup.string().required('Please enter your city'),
    state: Yup.string().required('Please enter your state'),
    zipCode: Yup.string().required('Please enter zip code'),
    sameCorrespondenceAddress: Yup.bool(),
    correspondenceAddress: Yup.object().when('sameCorrespondenceAddress', {
        is: false,
        then: (schema) =>
            schema.shape({
                country: Yup.string().required('Please select country'),
                addressLine1: Yup.string().required(
                    'Please enter your address',
                ),
                addressLine2: Yup.string(),
                city: Yup.string().required('Please enter your city'),
                state: Yup.string().required('Please enter your state'),
                zipCode: Yup.string().required('Please enter zip code'),
            }),
        otherwise: (schema) => schema,
    }),
})

const AddressForm = (props: AddressFormProps) => {
    const {
        values,
        touched,
        errors,
        countryName,
        addressLine1Name,
        addressLine2Name,
        cityName,
        stateName,
        zipCodeName,
    } = props

    const getError = useCallback(
        (name: string) => {
            return get(errors, name)
        },
        [errors],
    )

    const getTouched = useCallback(
        (name: string) => {
            return get(touched, name)
        },
        [touched],
    )

    const { t } = useTranslation()
    return (
        <>
            <div className="md:grid grid-cols-2 gap-4">
                <FormItem
                    label={t('text.labels.country')}
                    invalid={getError(countryName) && getTouched(countryName)}
                    errorMessage={getError(countryName)}
                >
                    <Field name={countryName}>
                        {({ field, form }: FieldProps) => (
                            <Select
                                placeholder={t('text.placeholders.country')}
                                field={field}
                                form={form}
                                options={countryList}
                                value={countryList.filter(
                                    (c) => c.value === get(values, countryName),
                                )}
                                onChange={(c) =>
                                    form.setFieldValue(field.name, c?.value)
                                }
                            />
                        )}
                    </Field>
                </FormItem>
                <FormItem
                    label={t('text.labels.addressLine1')}
                    invalid={
                        getError(addressLine1Name) &&
                        getTouched(addressLine1Name)
                    }
                    errorMessage={getError(addressLine1Name)}
                >
                    <Field
                        type="text"
                        autoComplete="off"
                        name={addressLine1Name}
                        placeholder={t('text.placeholders.addressLine1')}
                        component={Input}
                    />
                </FormItem>
            </div>
            <div className="md:grid grid-cols-2 gap-4">
                <FormItem
                    label={t('text.labels.addressLine2')}
                    invalid={
                        getError(addressLine2Name) &&
                        getTouched(addressLine2Name)
                    }
                    errorMessage={getError(addressLine2Name)}
                >
                    <Field
                        type="text"
                        autoComplete="off"
                        name={addressLine2Name}
                        placeholder={t('text.placeholders.addressLine2')}
                        component={Input}
                    />
                </FormItem>
                <FormItem
                    label={t('text.labels.city')}
                    invalid={getError(cityName) && getTouched(cityName)}
                    errorMessage={getError(cityName)}
                >
                    <Field
                        type="text"
                        autoComplete="off"
                        name={cityName}
                        placeholder={t('text.placeholders.city')}
                        component={Input}
                    />
                </FormItem>
            </div>
            <div className="md:grid grid-cols-2 gap-4">
                <FormItem
                    label={t('text.labels.state')}
                    invalid={getError(stateName) && getTouched(stateName)}
                    errorMessage={getError(stateName)}
                >
                    <Field
                        type="text"
                        autoComplete="off"
                        name={stateName}
                        placeholder={t('text.placeholders.state')}
                        component={Input}
                    />
                </FormItem>
                <FormItem
                    label={t('text.labels.zipCode')}
                    invalid={getError(zipCodeName) && getTouched(zipCodeName)}
                    errorMessage={getError(zipCodeName)}
                >
                    <Field
                        type="text"
                        autoComplete="off"
                        name={zipCodeName}
                        placeholder={t('text.placeholders.zipCode')}
                        component={Input}
                    />
                </FormItem>
            </div>
        </>
    )
}

const AddressInfomation = ({
    data = {
        country: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zipCode: '',
        sameCorrespondenceAddress: true,
        correspondenceAddress: {
            country: '',
            addressLine1: '',
            addressLine2: '',
            city: '',
            state: '',
            zipCode: '',
        },
    },
    onNextChange,
    onBackChange,
    currentStepStatus,
}: AddressInfomationProps) => {
    const onNext = (
        values: FormModel,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        onNextChange?.(values, 'addressInformation', setSubmitting)
    }

    const onBack = () => {
        onBackChange?.()
    }

    const { t } = useTranslation()
    return (
        <>
            <div className="mb-8">
                <h3 className="mb-2">{t('text.titles.addressInformation')}</h3>
                <p>{t('text.descriptions.addressInformation')}</p>
            </div>
            <Formik
                enableReinitialize
                initialValues={data}
                validationSchema={validationSchema}
                onSubmit={(values, { setSubmitting }) => {
                    setSubmitting(true)
                    setTimeout(() => {
                        onNext(values, setSubmitting)
                    }, 1000)
                }}
            >
                {({ values, touched, errors, isSubmitting }) => {
                    const formProps = { values, touched, errors }
                    return (
                        <Form>
                            <FormContainer>
                                <h5 className="mb-4">{t('text.titles.permanentAddress')}</h5>
                                <AddressForm
                                    countryName="country"
                                    addressLine1Name="addressLine1"
                                    addressLine2Name="addressLine2"
                                    cityName="city"
                                    stateName="state"
                                    zipCodeName="zipCode"
                                    {...formProps}
                                />
                                <FormItem>
                                    <Field name="sameCorrespondenceAddress">
                                        {({ field, form }: FieldProps) => (
                                            <Checkbox
                                                checked={
                                                    values.sameCorrespondenceAddress
                                                }
                                                onChange={(val) =>
                                                    form.setFieldValue(
                                                        field.name,
                                                        val,
                                                    )
                                                }
                                            >
                                                {t('text.labels.correspondenceSameAsAbove')}
                                            </Checkbox>
                                        )}
                                    </Field>
                                </FormItem>
                                {!values.sameCorrespondenceAddress && (
                                    <>
                                        <h5 className="mb-4">{t('text.titles.correspondenceAddress')}</h5>
                                        <AddressForm
                                            countryName="correspondenceAddress.country"
                                            addressLine1Name="correspondenceAddress.addressLine1"
                                            addressLine2Name="correspondenceAddress.addressLine2"
                                            cityName="correspondenceAddress.city"
                                            stateName="correspondenceAddress.state"
                                            zipCodeName="correspondenceAddress.zipCode"
                                            {...formProps}
                                        />
                                    </>
                                )}
                                <div className="flex justify-end gap-2">
                                    <Button type="button" onClick={onBack}>
                                        {t('text.actions.back')}
                                    </Button>
                                    <Button
                                        loading={isSubmitting}
                                        variant="solid"
                                        type="submit"
                                    >
                                        {currentStepStatus === 'complete'
                                            ? t('text.actions.save')
                                            : t('text.actions.next')}
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )
                }}
            </Formik>
        </>
    )
}

export default AddressInfomation
