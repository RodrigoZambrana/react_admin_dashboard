import { type CurrencyDefinition } from '../../shared/currency';
export type StandardCurrencyOption = CurrencyDefinition;
export declare const STANDARD_CURRENCIES: StandardCurrencyOption[];
export declare const STANDARD_CURRENCY_CODES: Set<string>;
export declare function getStandardCurrencySymbol(code?: string | null): string | undefined;
export { DEFAULT_CURRENCIES as STANDARD_DEFAULT_CURRENCIES } from '../../shared/currency';
