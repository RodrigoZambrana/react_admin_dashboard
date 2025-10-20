import type { TFunction } from 'i18next'

export const SALES_UNIT_VALUES = ['UNIT', 'SQUARE_METER', 'LINEAR_METER'] as const

export type SalesUnit = (typeof SALES_UNIT_VALUES)[number]

export const DEFAULT_SALES_UNIT: SalesUnit = 'UNIT'

const SALES_UNIT_LABEL_DEFAULTS: Record<SalesUnit, string> = {
    UNIT: 'Unit',
    SQUARE_METER: 'Square meter',
    LINEAR_METER: 'Linear meter',
}

export const buildSalesUnitOptions = (t: TFunction) =>
    SALES_UNIT_VALUES.map((value) => ({
        value,
        label: t(`text.salesUnit.${value}`, { defaultValue: SALES_UNIT_LABEL_DEFAULTS[value] }),
    }))

export const getSalesUnitLabel = (
    unit: string | undefined,
    t: TFunction,
): string => {
    const normalized = SALES_UNIT_VALUES.includes(unit as SalesUnit)
        ? (unit as SalesUnit)
        : DEFAULT_SALES_UNIT
    return t(`text.salesUnit.${normalized}`, {
        defaultValue: SALES_UNIT_LABEL_DEFAULTS[normalized],
    })
}
