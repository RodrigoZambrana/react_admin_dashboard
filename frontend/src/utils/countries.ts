/* eslint-disable  @typescript-eslint/no-explicit-any */
import countriesCsv from '@/assets/countries/countriesListIso.csv?raw'

export type CountryOption = { value: string; label: string }

export function parseCountriesCsv(): CountryOption[] {
  const raw = (countriesCsv || '').replace(/^\uFEFF/, '')
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return []
  const header = lines[0]
  const delimiter = header.includes(';') ? ';' : ','
  const headers = header.toLowerCase().split(delimiter).map((h) => h.trim())
  const idxCode = headers.findIndex((h) => ['code', 'iso', 'iso2', 'alpha2'].some((k) => h.includes(k)))
  const idxName = headers.findIndex((h) => ['name', 'country', 'pais', 'país'].some((k) => h.includes(k)))
  const opts: CountryOption[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter)
    let code = ''
    let name = ''
    if (idxCode >= 0 && idxName >= 0) {
      code = (parts[idxCode] || '').replace(/"/g, '').trim()
      name = (parts[idxName] || '').replace(/"/g, '').trim()
    } else {
      code = (parts[0] || '').replace(/"/g, '').trim()
      name = (parts[1] || '').replace(/"/g, '').trim()
    }
    if (code && name) opts.push({ value: code, label: name })
  }
  return opts
}

export function findCountryByName(name?: string) {
  if (!name) return undefined
  const list = parseCountriesCsv()
  return list.find((c) => c.label === name)
}

export function findCountryByCode(code?: string) {
  if (!code) return undefined
  const list = parseCountriesCsv()
  return list.find((c) => c.value === code)
}
