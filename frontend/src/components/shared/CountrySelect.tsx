import { ChangeEvent, useMemo } from 'react'
import {
  COUNTRY_CITY_SELECT_CLASS,
  deriveCountryCode,
  useCountryCityData,
} from '@/components/shared/countryCity'

type CountrySelectProps = {
  value?: { code?: string; name?: string }
  onChange: (val: { code?: string; name?: string }) => void
  placeholder?: string
  className?: string
  isDisabled?: boolean
}

export default function CountrySelect({
  value,
  onChange,
  placeholder = 'Selecciona un país',
  className,
  isDisabled,
}: CountrySelectProps) {
  const { countries, loading, error } = useCountryCityData()

  const selectClassName = useMemo(() => {
    return [COUNTRY_CITY_SELECT_CLASS, className].filter(Boolean).join(' ')
  }, [className])

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedName = event.target.value || undefined
    const next = {
      name: selectedName,
      code: selectedName ? deriveCountryCode(selectedName) : undefined,
    }
    onChange(next)
  }

  const disabled = Boolean(isDisabled || loading || !!error)

  return (
    <select
      className={selectClassName}
      value={value?.name ?? ''}
      onChange={handleChange}
      disabled={disabled}
    >
      <option value="">
        {loading ? 'Cargando países…' : error ? 'Error al cargar' : placeholder}
      </option>
      {countries.map((country) => (
        <option key={country} value={country}>
          {country}
        </option>
      ))}
    </select>
  )
}
