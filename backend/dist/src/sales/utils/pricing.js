"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALE_MARKUP = void 0;
exports.decimalToNumber = decimalToNumber;
exports.roundCurrency = roundCurrency;
exports.salePriceFromCost = salePriceFromCost;
exports.costPriceFromSale = costPriceFromSale;
exports.derivePricingFromLegacyPrice = derivePricingFromLegacyPrice;
exports.calculateOrderLineTotals = calculateOrderLineTotals;
const client_1 = require("@prisma/client");
exports.SALE_MARKUP = 1.3;
function decimalToNumber(value) {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value.toNumber === 'function') {
        const numeric = value.toNumber();
        return Number.isFinite(numeric) ? numeric : 0;
    }
    return 0;
}
function roundCurrency(value) {
    try {
        const decimal = new client_1.Prisma.Decimal(value ?? 0).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
        return Number(decimal.toString());
    }
    catch (error) {
        return 0;
    }
}
function salePriceFromCost(cost) {
    return roundCurrency(cost * exports.SALE_MARKUP);
}
function costPriceFromSale(sale) {
    if (!Number.isFinite(sale))
        return 0;
    return roundCurrency(sale / exports.SALE_MARKUP);
}
function derivePricingFromLegacyPrice(legacyPrice) {
    const costPrice = roundCurrency(Number.isFinite(legacyPrice) ? legacyPrice : 0);
    const salePrice = salePriceFromCost(costPrice);
    return { costPrice, salePrice };
}
function calculateOrderLineTotals(input) {
    const quantityRaw = Number(input.qty ?? 0);
    const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;
    const saleUnit = input.price !== null && input.price !== undefined
        ? decimalToNumber(input.price)
        : decimalToNumber(input.product?.salePrice);
    const costUnit = decimalToNumber(input.product?.costPrice);
    const saleTotal = roundCurrency(quantity * saleUnit);
    const costTotal = roundCurrency(quantity * costUnit);
    return { saleTotal, costTotal };
}
//# sourceMappingURL=pricing.js.map