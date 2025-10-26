"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_DEFAULT_CURRENCIES = exports.STANDARD_CURRENCY_CODES = exports.STANDARD_CURRENCIES = void 0;
exports.getStandardCurrencySymbol = getStandardCurrencySymbol;
const currency_1 = require("../../shared/currency");
exports.STANDARD_CURRENCIES = Array.from(currency_1.CURRENCY_DEFINITIONS);
exports.STANDARD_CURRENCY_CODES = new Set(exports.STANDARD_CURRENCIES.map((item) => item.code));
function getStandardCurrencySymbol(code) {
    if (!code) {
        return undefined;
    }
    const normalized = String(code).trim().toUpperCase();
    if (!normalized) {
        return undefined;
    }
    return currency_1.CURRENCY_DEFINITION_MAP.get(normalized)?.symbol;
}
var currency_2 = require("../../shared/currency");
Object.defineProperty(exports, "STANDARD_DEFAULT_CURRENCIES", { enumerable: true, get: function () { return currency_2.DEFAULT_CURRENCIES; } });
//# sourceMappingURL=currency.constants.js.map