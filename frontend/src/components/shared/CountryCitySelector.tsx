import { useEffect, useMemo, useState } from 'react'
import Select from '@/components/ui/Select'
// Load CSV as raw text (Vite supports ?raw)
// Expected CSV headers: code,name (ISO code, country name)
// Example row: US,United States
import countriesCsv from '@/assets/countries/countriesListIso.csv?raw'
import { apiGetCities } from '@/services/SettingsService'

export type CountryCityValue = {
  countryCode?: string
  countryName?: string
  city?: string
}

type Option = { value: string; label: string }

export default function CountryCitySelector({
  value,
  onChange,
  defaultCountryCode,
  fetchCities,
  countryPlaceholder = 'Country',
  cityPlaceholder = 'City',
  className,
}: {
  value: CountryCityValue
  onChange: (val: CountryCityValue) => void
  defaultCountryCode?: string
  fetchCities?: (countryCode: string) => Promise<Option[]>
  countryPlaceholder?: string
  cityPlaceholder?: string
  className?: string
}) {
  const [countries, setCountries] = useState<Option[]>([])
  const [cities, setCities] = useState<Option[]>([])

  const parseCountries = () => {
    // Handle BOM and various delimiters, flexible headers
    const raw = countriesCsv.replace(/^\uFEFF/, '')
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return []
    const header = lines[0]
    const delimiter = header.includes(';') ? ';' : ','
    const headers = header.toLowerCase().split(delimiter).map((h) => h.trim())
    let idxCode = headers.findIndex((h) => ['code', 'iso', 'iso2', 'alpha2'].some((k) => h.includes(k)))
    let idxName = headers.findIndex((h) => ['name', 'country', 'pais', 'país'].some((k) => h.includes(k)))
    const opts: Option[] = []
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter)
      let code = ''
      let name = ''
      if (idxCode >= 0 && idxName >= 0) {
        code = (parts[idxCode] || '').replace(/"/g, '').trim()
        name = (parts[idxName] || '').replace(/"/g, '').trim()
      } else {
        // Fallback to first two columns
        code = (parts[0] || '').replace(/"/g, '').trim()
        name = (parts[1] || '').replace(/"/g, '').trim()
      }
      if (code && name) opts.push({ value: code, label: name })
    }
    return opts
  }

  useEffect(() => {
    setCountries(parseCountries())
  }, [])

  // Load cities for selected or default country
  useEffect(() => {
    const cc = value.countryCode || defaultCountryCode
    if (!cc) return
    const loader = fetchCities || (async (code: string) => {
      const res = await apiGetCities<{ name: string }[], { country: string }>({ country: code })
      return (res.data as any[]).map((x) => ({ value: x.name, label: x.name }))
    })
    loader(cc).then(setCities).catch(() => setCities([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.countryCode, defaultCountryCode])

  const selectedCountry = useMemo(() => {
    if (value.countryCode) return countries.find((c) => c.value === value.countryCode)
    if (value.countryName) return countries.find((c) => c.label === value.countryName)
    if (defaultCountryCode) return countries.find((c) => c.value === defaultCountryCode)
    return undefined
  }, [countries, value.countryCode, value.countryName, defaultCountryCode])

  const selectedCity = useMemo(() => {
    if (!value.city) return undefined
    return cities.find((c) => c.label === value.city)
  }, [cities, value.city])

  const handleCountry = (opt?: Option | null) => {
    const code = opt?.value
    const name = opt?.label
    onChange({ countryCode: code, countryName: name, city: undefined })
  }
  const handleCity = (opt?: Option | null) => {
    onChange({ ...value, city: opt?.label })
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2">
        <Select
          options={countries}
          value={selectedCountry as any}
          placeholder={countryPlaceholder}
          onChange={handleCountry as any}
        />
        <Select
          options={cities}
          value={selectedCity as any}
          placeholder={cityPlaceholder}
          onChange={handleCity as any}
          isDisabled={!selectedCountry}
        />
      </div>
    </div>
  )
}
