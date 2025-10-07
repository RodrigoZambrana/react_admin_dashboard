import { useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'

export const COUNTRY_CITY_CSV_URL = '/data/cities.csv'
export const COUNTRY_CITY_SELECT_CLASS =
  'w-full rounded-2xl border px-3 py-2 shadow-sm disabled:opacity-60'

export type CityRow = {
  country_name?: string
  name?: string
}

type CacheEntry = {
  rows: CityRow[] | null
  error: string | null
}

const cache = new Map<string, CacheEntry>()
const pendingFetches = new Map<string, Promise<CityRow[]>>()

const normalizeCountryKey = (value?: string) => (value || '').trim().toLowerCase()

const fetchRows = async (csvUrl: string): Promise<CityRow[]> => {
  const response = await fetch(csvUrl, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(`No se pudo cargar CSV: ${response.status}`)
  }
  const text = await response.text()
  const parsed = Papa.parse<CityRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  })
  return parsed.data
}

const ensureRows = async (csvUrl: string): Promise<CityRow[]> => {
  const existing = cache.get(csvUrl)
  if (existing?.rows) {
    return existing.rows
  }
  const pending = pendingFetches.get(csvUrl)
  if (pending) {
    return pending
  }
  const request = fetchRows(csvUrl)
    .then((rows) => {
      cache.set(csvUrl, { rows, error: null })
      return rows
    })
    .catch((error: any) => {
      cache.set(csvUrl, { rows: null, error: error?.message ?? 'Error leyendo CSV' })
      throw error
    })
    .finally(() => {
      pendingFetches.delete(csvUrl)
    })

  pendingFetches.set(csvUrl, request)
  return request
}

export const deriveCountryCode = (countryName: string): string => {
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

export const useCountryCityData = (csvUrl = COUNTRY_CITY_CSV_URL) => {
  const [rows, setRows] = useState<CityRow[] | null>(() => cache.get(csvUrl)?.rows ?? null)
  const [error, setError] = useState<string | null>(() => cache.get(csvUrl)?.error ?? null)
  const [loading, setLoading] = useState<boolean>(() => !cache.has(csvUrl))

  useEffect(() => {
    let alive = true
    setLoading(!cache.get(csvUrl)?.rows)

    ensureRows(csvUrl)
      .then((fetchedRows) => {
        if (!alive) return
        setRows(fetchedRows)
        setError(null)
        setLoading(false)
      })
      .catch((err: any) => {
        if (!alive) return
        setRows(null)
        setError(err?.message ?? 'Error leyendo CSV')
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [csvUrl])

  const countries = useMemo(() => {
    if (!rows) return []
    const set = new Set<string>()
    for (const row of rows) {
      const country = (row.country_name ?? '').trim()
      if (country) {
        set.add(country)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const citiesByCountry = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!rows) return map
    for (const row of rows) {
      const country = (row.country_name ?? '').trim()
      const city = (row.name ?? '').trim()
      if (!country || !city) continue
      const key = normalizeCountryKey(country)
      const entries = map.get(key) ?? []
      if (!entries.some((c) => c.toLowerCase() === city.toLowerCase())) {
        entries.push(city)
        entries.sort((a, b) => a.localeCompare(b))
      }
      map.set(key, entries)
    }
    return map
  }, [rows])

  const getCitiesForCountry = useCallback(
    (countryName?: string) => {
      if (!countryName) return []
      const key = normalizeCountryKey(countryName)
      return citiesByCountry.get(key) ?? []
    },
    [citiesByCountry],
  )

  const getFirstCityForCountry = useCallback(
    (countryName?: string) => {
      const cities = getCitiesForCountry(countryName)
      return cities.length > 0 ? cities[0] : ''
    },
    [getCitiesForCountry],
  )

  return {
    rows,
    countries,
    getCitiesForCountry,
    getFirstCityForCountry,
    loading,
    error,
  }
}
