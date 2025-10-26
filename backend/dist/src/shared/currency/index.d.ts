export type CurrencyDefinition = {
    code: string;
    label: string;
    symbol: string;
    narrowSymbol?: string;
    aliases?: string[];
};
export declare const CURRENCY_DEFINITIONS: readonly CurrencyDefinition[];
export declare const CURRENCY_DEFINITION_MAP: ReadonlyMap<string, CurrencyDefinition>;
export declare const DEFAULT_CURRENCIES: readonly ["USD", "UYU"];
export declare function getCurrencyDefinition(code?: string | null): CurrencyDefinition | undefined;
export declare function getCurrencySymbol(code?: string | null): string | undefined;
export declare function isKnownCurrency(code?: string | null): boolean;
