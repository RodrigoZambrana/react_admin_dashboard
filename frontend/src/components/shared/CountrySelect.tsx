import { useEffect, useMemo, useState } from 'react'
import Select from '@/components/ui/Select'
import { apiGetCountries } from '@/services/SettingsService'

export default function CountrySelect({
  value,
  onChange,
  placeholder = 'Country',
  className,
}: {
  value?: { code?: string; name?: string }
  onChange: (val: { code?: string; name?: string }) => void
  placeholder?: string
  className?: string
}) {
  const [countries, setCountries] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    apiGetCountries<{ code: string; name: string }[]>()
      .then((res) => setCountries((res.data as any[]).map((c) => ({ value: c.code, label: c.name }))))
      .catch(() => setCountries([]))
  }, [])
  const selected = useMemo(() => {
    if (value?.code) return countries.find((c) => c.value === value.code)
    if (value?.name) return countries.find((c) => c.label === value.name)
    return undefined
  }, [countries, value?.code, value?.name])

  return (
    <div className={className}>
      <Select
        options={countries}
        value={selected as any}
        placeholder={placeholder}
        onChange={(opt: any) => onChange({ code: opt?.value, name: opt?.label })}
      />
    </div>
  )
}
