import React, { useEffect, useMemo, useState } from 'react'
import { Field, FieldProps, getIn, useFormikContext } from 'formik'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import { useTranslation } from 'react-i18next'
import type { FormModel } from './CustomerForm'
import Papa from 'papaparse'

// ===== Config =====
const CSV_URL = '/data/cities.csv' // ajusta la ruta si tu CSV está en otro lado
const SELECT_CLASS =
  'w-full rounded-2xl border px-3 py-2 shadow-sm disabled:opacity-60'

// ===== Tipos CSV =====
type CityRow = {
  country_name?: string
  name?: string // ciudad
}

const deriveCountryCode = (countryName: string): string => {
  if (!countryName) return ''
  const normalized = countryName.trim()
  const predefined: Record<string, string> = {
    Uruguay: 'UY',
    Argentina: 'AR',
    Brasil: 'BR',
    Brazil: 'BR',
    Chile: 'CL',
    Paraguay: 'PY',
    Perú: 'PE',
    Peru: 'PE',
    Bolivia: 'BO',
    Colombia: 'CO',
    México: 'MX',
    Mexico: 'MX',
    España: 'ES',
    Spain: 'ES',
  }
  if (predefined[normalized]) {
    return predefined[normalized]
  }
  const sanitized = normalized.replace(/[^A-Za-z]/g, ' ').trim()
  if (!sanitized) return ''
  const words = sanitized.split(/\s+/)
  if (words.length === 1) {
    const word = words[0].toUpperCase()
    if (word.length >= 2) return word.slice(0, 2)
    if (word.length === 1) return `${word}${word}`
    return ''
  }
  const initials = words
    .map((w) => (w[0] || '').toUpperCase())
    .join('')
    .replace(/[^A-Z]/g, '')
  if (initials.length >= 2) return initials.slice(0, 3)
  return sanitized.slice(0, 2).toUpperCase()
}

// ===== Select País (distinct desde CSV) =====
function CountryCsvSelect({
  countries,
  value,
  onChange,
  placeholder = 'Selecciona un país',
  disabled,
  className,
}: {
  countries: string[]
  value?: string
  onChange?: (countryName: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      className={className ?? SELECT_CLASS}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {countries.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

// ===== Select Ciudad (filtra por country_name) =====
function CitySelect({
  rows,
  countryName,
  value,
  onChange,
  placeholder = 'Selecciona una ciudad',
  disabled,
  className,
}: {
  rows: CityRow[] | null
  countryName?: string
  value?: string
  onChange?: (cityName: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const citiesForCountry = useMemo(() => {
    if (!rows || !countryName) return []
    const filtered = rows.filter(
      (r) => (r.country_name ?? '').toLowerCase() === countryName.toLowerCase(),
    )
    const seen = new Set<string>()
    const unique: string[] = []
    for (const r of filtered) {
      const city = (r.name ?? '').trim()
      if (!city || seen.has(city.toLowerCase())) continue
      seen.add(city.toLowerCase())
      unique.push(city)
    }
    unique.sort((a, b) => a.localeCompare(b))
    return unique
  }, [rows, countryName])

  return (
    <select
      className={className ?? SELECT_CLASS}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled || !countryName || citiesForCountry.length === 0}
    >
      <option value="">
        {disabled
          ? placeholder
          : citiesForCountry.length === 0
            ? 'No hay ciudades'
            : placeholder}
      </option>
      {citiesForCountry.map((city) => (
        <option key={city} value={city}>
          {city}
        </option>
      ))}
    </select>
  )
}

const AddressForm = () => {
  const { t } = useTranslation()
  const { values, errors, touched, setFieldValue } = useFormikContext<FormModel>()
  const address = values.address

  const fieldError = (name: string) => getIn(errors, `address.${name}`)
  const fieldTouched = (name: string) => getIn(touched, `address.${name}`)

  // ===== Carga CSV una única vez =====
  const [rows, setRows] = useState<CityRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const res = await fetch(CSV_URL, { cache: 'force-cache' })
        if (!res.ok) throw new Error(`No se pudo cargar CSV: ${res.status}`)
        const text = await res.text()
        const parsed = Papa.parse<CityRow>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h: string) => h.trim(), // evita TS7006
        })
        if (alive) setRows(parsed.data)
      } catch (e: any) {
        if (alive) setErr(e?.message ?? 'Error leyendo CSV')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // ===== Lista de países (distinct y ordenados) =====
  const countries = useMemo(() => {
    if (!rows) return []
    const set = new Set<string>()
    for (const r of rows) {
      const cn = (r.country_name ?? '').trim()
      if (cn) set.add(cn)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  // ===== Helper: primera ciudad para un país =====
  const pickFirstCity = (country: string): string => {
    if (!rows) return ''
    return (
      rows
        .filter(
          (r) => (r.country_name ?? '').toLowerCase() === country.toLowerCase(),
        )
        .map((r) => (r.name ?? '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))[0] || ''
    )
  }

  // ===== Inicialización robusta (Uruguay / Montevideo si existen) =====
  useEffect(() => {
    if (!rows || rows.length === 0) return
    // Si ya hay valores definidos, no tocar
    if (address?.state && address?.city) return

    const hasUruguay = rows.some(
      (r) => (r.country_name ?? '').toLowerCase() === 'uruguay',
    )

    if (hasUruguay) {
      const firstUy = pickFirstCity('Uruguay')
      // Si existe Montevideo, respetarlo; si no, usar la primera ciudad
      const montevideo = rows.some(
        (r) =>
          (r.country_name ?? '').toLowerCase() === 'uruguay' &&
          (r.name ?? '').trim().toLowerCase() === 'montevideo',
      )
      setFieldValue('address.state', 'Uruguay')
      setFieldValue('address.city', montevideo ? 'Montevideo' : firstUy)
      setFieldValue('address.countryCode', deriveCountryCode('Uruguay'))
      return
    }

    // Si no hay Uruguay en CSV → primer país/primera ciudad
    const firstCountry = countries[0]
    if (firstCountry) {
      setFieldValue('address.state', firstCountry)
      setFieldValue('address.city', pickFirstCity(firstCountry))
      setFieldValue('address.countryCode', deriveCountryCode(firstCountry))
    }
  }, [rows, countries, address?.state, address?.city, setFieldValue])

  // ===== Al cambiar país: setear país + primera ciudad inmediatamente =====
  const handleCountryChange = (countryName: string) => {
    if (!countryName) {
      // Si se borra el país, no vaciamos city por validación; el schema requiere city.
      setFieldValue('address.state', '')
      setFieldValue('address.countryCode', '')
      return
    }
    // Calcular primera ciudad antes de tocar el form, para no dejar city vacío
    const nextFirstCity = pickFirstCity(countryName)
    setFieldValue('address.state', countryName)
    setFieldValue('address.countryCode', deriveCountryCode(countryName))
    setFieldValue('address.city', nextFirstCity || address.city || '')
  }

  return (
    <div className="grid grid-cols-1 gap-3">
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
        {/* País: distinct desde CSV + mismo estilo de select */}
        <FormItem
          label={t('text.labels.country')}
          invalid={Boolean(fieldTouched('state') && fieldError('state'))}
          errorMessage={fieldError('state') as string}
        >
          <CountryCsvSelect
            countries={countries}
            value={address.state}
            onChange={handleCountryChange}
            placeholder={
              loading
                ? 'Cargando países…'
                : err
                  ? 'Error al cargar'
                  : t('text.labels.country')
            }
            disabled={loading || !!err}
          />
        </FormItem>

        {/* Ciudad: autoselección de primera ciudad al cambiar país */}
        <FormItem
          label={t('text.labels.city')}
          invalid={Boolean(fieldTouched('city') && fieldError('city'))}
          errorMessage={fieldError('city') as string}
        >
          <CitySelect
            rows={rows}
            countryName={address.state}
            value={address.city}
            onChange={(city) => setFieldValue('address.city', city)}
            placeholder={t('text.labels.city')}
            disabled={loading || !!err || !address.state}
          />
        </FormItem>
      </div>
    </div>
  )
}

export default AddressForm
