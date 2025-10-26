"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimal = decimal;
exports.roundDecimal = roundDecimal;
exports.addDecimals = addDecimals;
exports.subtractDecimals = subtractDecimals;
exports.multiplyDecimals = multiplyDecimals;
exports.divideDecimals = divideDecimals;
exports.decimalToNumber = decimalToNumber;
const client_1 = require("@prisma/client");
const DecimalCtor = client_1.Prisma.Decimal;
function decimal(value) {
    if (value === null || value === undefined || value === '') {
        return new DecimalCtor(0);
    }
    try {
        return new DecimalCtor(value);
    }
    catch (error) {
        return new DecimalCtor(0);
    }
}
function roundDecimal(value, scale = 2) {
    return decimal(value).toDecimalPlaces(scale, DecimalCtor.ROUND_HALF_UP);
}
function addDecimals(a, b) {
    return decimal(a).plus(decimal(b));
}
function subtractDecimals(a, b) {
    return decimal(a).minus(decimal(b));
}
function multiplyDecimals(a, b) {
    return decimal(a).times(decimal(b));
}
function divideDecimals(a, b) {
    const denominator = decimal(b);
    if (denominator.isZero()) {
        throw new Error('Division by zero');
    }
    return decimal(a).dividedBy(denominator);
}
function decimalToNumber(value, scale = 2) {
    return Number(roundDecimal(value, scale).toString());
}
//# sourceMappingURL=money.util.js.map