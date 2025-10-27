import React, { useEffect } from 'react'
import { Field, FieldProps, getIn, useFormikContext } from 'formik'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import type { FormModel } from './CustomerForm'
import CountrySelect from '@/components/shared/CountrySelect'
import CitySelect from '@/components/shared/CitySelect'
import {
  deriveCountryCode,
  useCountryCityData,
} from '@/components/shared/countryCity'

const AddressForm = () => {
  const { t } = useTranslation()
  const { values, errors, touched, setFieldValue } = useFormikContext<FormModel>()
  const address = values.address

  const fieldError = (name: string) => getIn(errors, `address.${name}`)
  const fieldTouched = (name: string) => getIn(touched, `address.${name}`)

  const { rows, countries, getFirstCityForCountry, loading, error } = useCountryCityData()

  useEffect(() => {
    if (!rows || rows.length === 0) return
    if (address?.state && address?.city) return

    const hasUruguay = rows.some(
      (row) => (row.country_name ?? '').trim().toLowerCase() === 'uruguay',
    )

    if (hasUruguay) {
      const firstCityInUruguay = getFirstCityForCountry('Uruguay')
      const hasMontevideo = rows.some(
        (row) =>
          (row.country_name ?? '').trim().toLowerCase() === 'uruguay' &&
          (row.name ?? '').trim().toLowerCase() === 'montevideo',
      )
      setFieldValue('address.state', 'Uruguay')
      setFieldValue('address.city', hasMontevideo ? 'Montevideo' : firstCityInUruguay)
      setFieldValue('address.countryCode', deriveCountryCode('Uruguay'))
      return
    }

    const firstCountry = countries[0]
    if (firstCountry) {
      setFieldValue('address.state', firstCountry)
      setFieldValue('address.city', getFirstCityForCountry(firstCountry))
      setFieldValue('address.countryCode', deriveCountryCode(firstCountry))
    }
  }, [
    rows,
    countries,
    address?.state,
    address?.city,
    getFirstCityForCountry,
    setFieldValue,
  ])

  const handleCountryChange = (country?: { code?: string; name?: string }) => {
    const countryName = country?.name ?? ''
    if (!countryName) {
      setFieldValue('address.state', '')
      setFieldValue('address.countryCode', '')
      return
    }
    const nextFirstCity = getFirstCityForCountry(countryName)
    const nextCode = country?.code ?? deriveCountryCode(countryName)
    setFieldValue('address.state', countryName)
    setFieldValue('address.countryCode', nextCode)
    setFieldValue('address.city', nextFirstCity || address.city || '')
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <FormItem
        label={t('text.labels.addressLabel', { defaultValue: 'Address label' })}
        invalid={Boolean(fieldTouched('label') && fieldError('label'))}
        errorMessage={fieldError('label') as string}
      >
        <Field name="address.label">
          {({ field }: FieldProps<string>) => (
            <Input
              {...field}
              onChange={(e) => setFieldValue('address.label', e.target.value)}
            />
          )}
        </Field>
      </FormItem>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormItem
          label={t('text.labels.street')}
          invalid={Boolean(fieldTouched('street') && fieldError('street'))}
          errorMessage={fieldError('street') as string}
        >
          <Field name="address.street">
            {({ field }: FieldProps<string>) => (
              <Input
                {...field}
                onChange={(e) => setFieldValue('address.street', e.target.value)}
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
                onChange={(e) => setFieldValue('address.number', e.target.value)}
              />
            )}
          </Field>
        </FormItem>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormItem label={t('text.labels.corner')}>
          <Field name="address.corner">
            {({ field }: FieldProps<string>) => (
              <Input
                {...field}
                onChange={(e) => setFieldValue('address.corner', e.target.value)}
              />
            )}
          </Field>
        </FormItem>
        <FormItem label={t('text.labels.apartment')}>
          <Field name="address.apartment">
            {({ field }: FieldProps<string>) => (
              <Input
                {...field}
                onChange={(e) =>
                  setFieldValue('address.apartment', e.target.value)
                }
              />
            )}
          </Field>
        </FormItem>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormItem
          label={t('text.labels.country')}
          invalid={Boolean(fieldTouched('state') && fieldError('state'))}
          errorMessage={fieldError('state') as string}
        >
          <CountrySelect
            value={{ code: address.countryCode, name: address.state }}
            onChange={handleCountryChange}
            placeholder={t('text.labels.country')}
            className="w-full"
            isDisabled={loading || !!error}
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
            className="w-full"
            isDisabled={loading || !!error}
          />
        </FormItem>
      </div>
      <FormItem
        label={t('text.labels.comments')}
        invalid={Boolean(fieldTouched('comments') && fieldError('comments'))}
        errorMessage={fieldError('comments') as string}
      >
        <Field name="address.comments">
          {({ field }: FieldProps<string>) => (
            <Input
              {...field}
              textArea
              rows={3}
              onChange={(e) => setFieldValue('address.comments', e.target.value)}
            />
          )}
        </Field>
      </FormItem>
    </div>
  )
}

export default AddressForm
