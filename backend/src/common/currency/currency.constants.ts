export type StandardCurrencyOption = {
  code: string
  label: string
  symbol: string
}

export const STANDARD_CURRENCIES: StandardCurrencyOption[] = [
  { code: 'USD', label: 'United States Dollar', symbol: '$' },
  { code: 'UYU', label: 'Uruguayan Peso', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound Sterling', symbol: '£' },
  { code: 'ARS', label: 'Argentine Peso', symbol: '$' },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { code: 'CLP', label: 'Chilean Peso', symbol: '$' },
  { code: 'MXN', label: 'Mexican Peso', symbol: '$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: '$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: '$' },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: '$' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'PEN', label: 'Peruvian Sol', symbol: 'S/' },
  { code: 'COP', label: 'Colombian Peso', symbol: '$' },
  { code: 'PYG', label: 'Paraguayan Guaraní', symbol: '₲' },
  { code: 'BOB', label: 'Boliviano', symbol: 'Bs' },
  { code: 'VES', label: 'Venezuelan Bolívar', symbol: 'Bs.' },
  { code: 'CRC', label: 'Costa Rican Colón', symbol: '₡' },
]

export const STANDARD_CURRENCY_CODES = new Set(STANDARD_CURRENCIES.map((item) => item.code))
