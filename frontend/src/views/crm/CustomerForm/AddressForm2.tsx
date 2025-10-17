import { Field, FieldProps, getIn, useFormikContext } from 'formik'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import CountrySelect from '@/components/shared/CountrySelect'
import CitySelect from '@/components/shared/CitySelect'
import { useTranslation } from 'react-i18next'
import type { FormModel } from './CustomerForm'

const AddressForm = () => {
    const { t } = useTranslation()
    const { values, errors, touched, setFieldValue } = useFormikContext<FormModel>()
    const address = values.address

    const fieldError = (name: string) => getIn(errors, `address.${name}`)
    const fieldTouched = (name: string) => getIn(touched, `address.${name}`)

    const handleInputChange = (name: keyof FormModel['address']) => (value: string) => {
        const sanitizedValue = name === 'number' ? value.replace(/\D/g, '') : value
        setFieldValue(`address.${name}`, sanitizedValue)
    }

    return (
        <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-3">
                <FormItem
                    label={t('text.labels.street')}
                    invalid={Boolean(fieldTouched('street') && fieldError('street'))}
                    errorMessage={fieldError('street') as string}
                >
                    <Field name="address.street">
                        {({ field }: FieldProps<string>) => (
                            <Input
                                {...field}
                                onChange={(e) => handleInputChange('street')(e.target.value)}
                            />
                        )}
                    </Field>
                </FormItem>
                <FormItem
                    label={t('text.labels.number')}
                    invalid={Boolean(fieldTouched('number') && fieldError('number'))}
                    errorMessage={fieldError('number') as string}
                >
                    <Field name="address.number">
                        {({ field }: FieldProps<string>) => (
                            <Input
                                {...field}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                onChange={(e) => handleInputChange('number')(e.target.value)}
                            />
                        )}
                    </Field>
                </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <FormItem label={t('text.labels.corner')}>
                    <Field name="address.corner">
                        {({ field }: FieldProps<string>) => (
                            <Input
                                {...field}
                                onChange={(e) => handleInputChange('corner')(e.target.value)}
                            />
                        )}
                    </Field>
                </FormItem>
                <FormItem label={t('text.labels.apartment')}>
                    <Field name="address.apartment">
                        {({ field }: FieldProps<string>) => (
                            <Input
                                {...field}
                                onChange={(e) => handleInputChange('apartment')(e.target.value)}
                            />
                        )}
                    </Field>
                </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <FormItem
                    label={t('text.labels.country')}
                    invalid={Boolean(fieldTouched('state') && fieldError('state'))}
                    errorMessage={fieldError('state') as string}
                >
                    <CountrySelect
                        value={{
                            name: address.state,
                            code: address.countryCode,
                        }}
                        onChange={(val) => {
                            setFieldValue('address.state', val.name ?? '')
                            setFieldValue('address.countryCode', val.code ?? '')
                            setFieldValue('address.city', '')
                        }}
                        placeholder={t('text.labels.country')}
                    />
                </FormItem>
                <FormItem
                    label={t('text.labels.city')}
                    invalid={Boolean(fieldTouched('city') && fieldError('city'))}
                    errorMessage={fieldError('city') as string}
                >
                    <CitySelect
                        countryCode={address.countryCode}
                        countryName={address.state}
                        value={address.city}
                        onChange={(city) => setFieldValue('address.city', city ?? '')}
                        placeholder={t('text.labels.city')}
                    />
                </FormItem>
            </div>
        </div>
    )
}

export default AddressForm
