import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

export type SeedEnvironment = 'development' | 'testing' | 'production' | string

export type SeedLog = {
  created: number
  skipped: number
  touched: number
}

export const resolveSeedEnvironment = (): SeedEnvironment =>
  (process.env.NODE_ENV ?? 'development').trim().toLowerCase()

export const normalizeSeedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

export const normalizeSeedBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return fallback
    }
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false
    }
  }
  return fallback
}

export const normalizeSeedNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

export const parseCsv = (value: unknown): string[] =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : []

export const hasAnyTruthyValue = (values: Array<unknown>): boolean =>
  values.some((value) => {
    if (typeof value === 'string') {
      return value.trim().length > 0
    }
    return Boolean(value)
  })

export async function seedJsonSetting(
  prisma: PrismaClient,
  environment: SeedEnvironment,
  key: string,
  value: Prisma.InputJsonValue,
): Promise<boolean> {
  const existing = await prisma.setting.findUnique({
    where: {
      key_environment: {
        key,
        environment,
      },
    },
    select: { id: true },
  })

  if (existing) {
    return false
  }

  await prisma.setting.upsert({
    where: {
      key_environment: {
        key,
        environment,
      },
    },
    update: {},
    create: {
      key,
      environment,
      value,
    },
  })

  return true
}
