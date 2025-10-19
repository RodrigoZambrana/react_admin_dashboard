import { Prisma } from '@prisma/client'

const DecimalCtor = Prisma.Decimal

export type Decimalish = Prisma.Decimal.Value | null | undefined

export function decimal(value: Decimalish): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    return new DecimalCtor(0)
  }
  try {
    return new DecimalCtor(value)
  } catch (error) {
    return new DecimalCtor(0)
  }
}

export function roundDecimal(value: Decimalish, scale = 2): Prisma.Decimal {
  return decimal(value).toDecimalPlaces(scale, DecimalCtor.ROUND_HALF_UP)
}

export function addDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal {
  return decimal(a).plus(decimal(b))
}

export function subtractDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal {
  return decimal(a).minus(decimal(b))
}

export function multiplyDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal {
  return decimal(a).times(decimal(b))
}

export function divideDecimals(a: Decimalish, b: Decimalish): Prisma.Decimal {
  const denominator = decimal(b)
  if (denominator.isZero()) {
    throw new Error('Division by zero')
  }
  return decimal(a).dividedBy(denominator)
}

export function decimalToNumber(value: Decimalish, scale = 2): number {
  return Number(roundDecimal(value, scale).toString())
}
