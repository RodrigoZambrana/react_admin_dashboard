import { useEffect, useState } from 'react'
import Select from '@/components/ui/Select'
import { apiGetCities } from '@/services/SettingsService'
import { findCountryByName } from '@/utils/countries'

export default function CitySelect({
  countryCode,
  countryName,
  value,
  onChange,
  placeholder = 'City',
  className,
}: {
  countryCode?: string
  countryName?: string
  value?: string
  onChange: (val?: string) => void
  placeholder?: string
  className?: string
}) {
  const [cities, setCities] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const code = countryCode || findCountryByName(countryName || '')?.value
    if (!code) return setCities([])
    apiGetCities<{ name: string }[], { country: string }>({ country: code })
      .then((res) => setCities((res.data as any[]).map((x) => ({ value: x.name, label: x.name }))))
      .catch(() => setCities([]))
  }, [countryCode, countryName])

  return (
    <div className={className}>
      <Select
        options={cities}
        value={value ? ({ value, label: value } as any) : undefined}
        placeholder={placeholder}
        onChange={(opt: any) => onChange(opt?.label)}
        isDisabled={(cities || []).length === 0}
      />
    </div>
  )
}

