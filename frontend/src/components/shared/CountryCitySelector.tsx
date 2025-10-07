import CountrySelect from '@/components/shared/CountrySelect'
import CitySelect from '@/components/shared/CitySelect'
import { deriveCountryCode, useCountryCityData } from '@/components/shared/countryCity'

export type CountryCityValue = {
  countryCode?: string
  countryName?: string
  city?: string
}

type CountryCitySelectorProps = {
  value: CountryCityValue
  onChange: (val: CountryCityValue) => void
  countryPlaceholder?: string
  cityPlaceholder?: string
  className?: string
  disabled?: boolean
  disableCountry?: boolean
  disableCity?: boolean
}

const DEFAULT_PLACEHOLDERS = {
  country: 'Country',
  city: 'City',
}

export default function CountryCitySelector({
  value,
  onChange,
  countryPlaceholder = DEFAULT_PLACEHOLDERS.country,
  cityPlaceholder = DEFAULT_PLACEHOLDERS.city,
  className,
  disabled,
  disableCountry,
  disableCity,
}: CountryCitySelectorProps) {
  const { getFirstCityForCountry } = useCountryCityData()

  const handleCountryChange = (country?: { code?: string; name?: string }) => {
    const nextName = country?.name?.trim()
    if (!nextName) {
      onChange({ countryCode: undefined, countryName: undefined, city: undefined })
      return
    }
    const code = country?.code || deriveCountryCode(nextName)
    const autoCity = getFirstCityForCountry(nextName) || undefined
    onChange({
      countryCode: code,
      countryName: nextName,
      city: autoCity,
    })
  }

  const handleCityChange = (city?: string) => {
    onChange({
      countryCode: value.countryCode,
      countryName: value.countryName,
      city: city ?? undefined,
    })
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CountrySelect
          value={{ code: value.countryCode, name: value.countryName }}
          onChange={handleCountryChange}
          placeholder={countryPlaceholder}
          className="w-full"
          isDisabled={disabled || disableCountry}
        />
        <CitySelect
          countryCode={value.countryCode}
          countryName={value.countryName}
          value={value.city}
          onChange={handleCityChange}
          placeholder={cityPlaceholder}
          className="w-full"
          isDisabled={disabled || disableCity}
        />
      </div>
    </div>
  )
}
