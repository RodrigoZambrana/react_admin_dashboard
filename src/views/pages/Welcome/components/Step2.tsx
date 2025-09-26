import Button from '@/components/ui/Button'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import { Field, Form, Formik } from 'formik'
import { HiArrowSmLeft } from 'react-icons/hi'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import type { CallbackSetBack } from '../types'
import type { FieldProps } from 'formik'

type Step2Props = CallbackSetBack

const validationSchema = Yup.object().shape({
    organizationName: Yup.string().required(
        'welcome.step2.validation.orgNameRequired',
    ),
    organizationSize: Yup.string().required(
        'welcome.step2.validation.orgSizeRequired',
    ),
})

const sizes = [
    { key: 'solo', value: 'solo' },
    { key: '2_10', value: '2~10' },
    { key: '11_50', value: '11~50' },
    { key: '51_200', value: '51~200' },
    { key: '201_500', value: '201~500' },
]

const Step2 = ({ onNext, onBack }: Step2Props) => {
    const { t } = useTranslation()
    return (
        <div className="text-center">
            <h3 className="mb-2">{t('welcome.step2.title')}</h3>
            <div className="mt-8 max-w-[600px] lg:min-w-[600px] mx-auto">
                <Formik
                    initialValues={{
                        organizationName: '',
                        organizationSize: '',
                    }}
                    validationSchema={validationSchema}
                    onSubmit={() => {
                        onNext?.()
                    }}
                >
                    {({ values, touched, errors }) => {
                        return (
                            <Form>
                                <FormContainer>
                                    <FormItem
                                        label={t('welcome.step2.labels.orgName')}
                                        invalid={
                                            errors.organizationName &&
                                            touched.organizationName
                                        }
                                        errorMessage={t(
                                            errors.organizationName as string,
                                        )}
                                    >
                                        <Field
                                            type="text"
                                            autoComplete="off"
                                            name="organizationName"
                                            placeholder={t(
                                                'welcome.step2.placeholders.orgName',
                                            )}
                                            component={Input}
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t('welcome.step2.labels.orgSize')}
                                        invalid={
                                            errors.organizationSize &&
                                            touched.organizationSize
                                        }
                                        errorMessage={t(
                                            errors.organizationSize as string,
                                        )}
                                    >
                                        <Field name="organizationSize">
                                            {({ field, form }: FieldProps) => (
                                                <Select
                                                    placeholder={t(
                                                        'welcome.step2.placeholders.orgSize',
                                                    )}
                                                    field={field}
                                                    form={form}
                                                    options={sizes.map((s) => ({
                                                        label: t(
                                                            `welcome.step2.sizes.${s.key}`,
                                                        ),
                                                        value: s.value,
                                                    }))}
                                                    value={sizes.filter(
                                                        (size) =>
                                                            size.value ===
                                                            values.organizationSize,
                                                    )}
                                                    onChange={(size) =>
                                                        form.setFieldValue(
                                                            field.name,
                                                            size?.value,
                                                        )
                                                    }
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem>
                                        <Button
                                            block
                                            variant="solid"
                                            type="submit"
                                        >
                                            {t('text.actions.next')}
                                        </Button>
                                        <Button
                                            block
                                            className="mt-4"
                                            variant="plain"
                                            type="button"
                                            icon={<HiArrowSmLeft />}
                                            onClick={onBack}
                                        >
                                            {t('text.actions.back')}
                                        </Button>
                                    </FormItem>
                                </FormContainer>
                            </Form>
                        )
                    }}
                </Formik>
            </div>
        </div>
    )
}

export default Step2
