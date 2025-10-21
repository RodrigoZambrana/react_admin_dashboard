import {
  CURRENCY_DEFINITIONS,
  CURRENCY_DEFINITION_MAP,
  type CurrencyDefinition,
} from '../../../shared/currency'

export type StandardCurrencyOption = CurrencyDefinition

export const STANDARD_CURRENCIES: StandardCurrencyOption[] = Array.from(CURRENCY_DEFINITIONS)

export const STANDARD_CURRENCY_CODES = new Set(
  STANDARD_CURRENCIES.map((item) => item.code),
)

export function getStandardCurrencySymbol(code?: string | null): string | undefined {
  if (!code) {
    return undefined
  }
  const normalized = String(code).trim().toUpperCase()
  if (!normalized) {
    return undefined
  }
  return CURRENCY_DEFINITION_MAP.get(normalized)?.symbol
}

export { DEFAULT_CURRENCIES as STANDARD_DEFAULT_CURRENCIES } from '../../../shared/currency'
