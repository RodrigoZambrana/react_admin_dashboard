import { ChangeEvent, useMemo } from 'react'
import {
  COUNTRY_CITY_SELECT_CLASS,
  deriveCountryCode,
  useCountryCityData,
} from '@/components/shared/countryCity'

type CitySelectProps = {
  countryCode?: string
  countryName?: string
  value?: string
  onChange: (val?: string) => void
  placeholder?: string
  className?: string
  isDisabled?: boolean
}

export default function CitySelect({
  countryCode,
  countryName,
  value,
  onChange,
  placeholder = 'Selecciona una ciudad',
  className,
  isDisabled,
}: CitySelectProps) {
  const { countries, getCitiesForCountry, loading, error } = useCountryCityData()

  const resolvedCountryName = useMemo(() => {
    if (countryName && countryName.trim()) return countryName
    if (!countryCode) return undefined
    const match = countries.find(
      (candidate) =>
        deriveCountryCode(candidate).toLowerCase() === countryCode.toLowerCase(),
    )
    return match
  }, [countries, countryCode, countryName])

  const cities = useMemo(() => {
    return getCitiesForCountry(resolvedCountryName)
  }, [getCitiesForCountry, resolvedCountryName])

  const selectClassName = useMemo(() => {
    return [COUNTRY_CITY_SELECT_CLASS, className].filter(Boolean).join(' ')
  }, [className])

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedCity = event.target.value || undefined
    onChange(selectedCity)
  }

  const disabled = Boolean(
    isDisabled || loading || !!error || !resolvedCountryName || cities.length === 0,
  )

  const placeholderText = (() => {
    if (loading) return 'Cargando ciudades…'
    if (error) return 'Error al cargar'
    if (!resolvedCountryName) return placeholder
    if (cities.length === 0) return 'No hay ciudades'
    return placeholder
  })()

  return (
    <select
      className={selectClassName}
      value={value ?? ''}
      onChange={handleChange}
      disabled={disabled}
    >
      <option value="">{placeholderText}</option>
      {cities.map((city) => (
        <option key={city} value={city}>
          {city}
        </option>
      ))}
    </select>
  )
}
