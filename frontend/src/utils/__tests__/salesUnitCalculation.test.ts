import {
    calculateLineTotal,
    getDerivedUnitPrice,
    getEffectiveQuantity,
    resolveSalesUnit,
} from '../salesUnitCalculation'

describe('salesUnitCalculation', () => {
    describe('resolveSalesUnit', () => {
        it('returns provided unit when valid', () => {
            expect(resolveSalesUnit('UNIT')).toBe('UNIT')
            expect(resolveSalesUnit('square_meter')).toBe('SQUARE_METER')
        })

        it('falls back to default when invalid', () => {
            expect(resolveSalesUnit('invalid' as any)).toBe('UNIT')
        })
    })

    describe('getEffectiveQuantity', () => {
        it('returns base quantity for UNIT products', () => {
            expect(
                getEffectiveQuantity({ qty: 3, unitOfMeasure: 'UNIT' }),
            ).toBe(3)
        })

        it('calculates area for square meter products', () => {
            expect(
                getEffectiveQuantity({
                    qty: 2,
                    unitOfMeasure: 'SQUARE_METER',
                    customAttributes: { width: 1.5, height: 2 },
                }),
            ).toBeCloseTo(6)
        })

        it('calculates length for linear meter products', () => {
            expect(
                getEffectiveQuantity({
                    qty: 4,
                    unitOfMeasure: 'LINEAR_METER',
                    customAttributes: { length: 2.5 },
                }),
            ).toBeCloseTo(10)
        })

        it('returns 0 when attributes are missing', () => {
            expect(
                getEffectiveQuantity({
                    qty: 5,
                    unitOfMeasure: 'SQUARE_METER',
                    customAttributes: {},
                }),
            ).toBe(0)
        })

        it('assumes single unit when quantity is omitted', () => {
            expect(
                getEffectiveQuantity({
                    unitOfMeasure: 'SQUARE_METER',
                    customAttributes: { width: 2, height: 3 },
                }),
            ).toBeCloseTo(6)
        })
    })

    describe('calculateLineTotal', () => {
        it('multiplies derived price by quantity', () => {
            expect(
                calculateLineTotal({
                    price: 120,
                    qty: 3,
                    unitOfMeasure: 'LINEAR_METER',
                    customAttributes: { length: 2 },
                }),
            ).toBeCloseTo(720)
        })

        it('returns 0 when measurement is missing', () => {
            expect(
                calculateLineTotal({
                    price: 50,
                    qty: 2,
                    unitOfMeasure: 'SQUARE_METER',
                    customAttributes: {},
                }),
            ).toBe(0)
        })
    })

    describe('getDerivedUnitPrice', () => {
        it('returns 0 until dimensions are provided for square meter products', () => {
            expect(
                getDerivedUnitPrice({
                    price: 10,
                    unitPrice: 10,
                    unitOfMeasure: 'SQUARE_METER',
                    customAttributes: {},
                }),
            ).toBe(0)
        })

        it('computes price based on dimensions', () => {
            expect(
                getDerivedUnitPrice({
                    price: 10,
                    unitPrice: 10,
                    unitOfMeasure: 'SQUARE_METER',
                    customAttributes: { width: 1, height: 2 },
                }),
            ).toBe(20)
        })
    })
})
