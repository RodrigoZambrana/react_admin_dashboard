import type { Prisma } from '@prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import type { ParametricModifierType, ParametricAdjustmentMode } from '@prisma/client'

export type PrismaClientOrTransaction = PrismaService | Prisma.TransactionClient

export type ParametricQuoteInput = {
  productId: number
  width: number | string
  height: number | string
  series: string
  color?: string | null
  glass?: string | null
  monoblock?: {
    enabled: boolean
    material?: string | null
    color?: string | null
  }
  mosquitoNet?: boolean
  currency?: string | null
}

export type ParametricModifierSnapshot = {
  type: ParametricModifierType
  code: string
  label?: string
  adjustmentMode: ParametricAdjustmentMode
  value: number
  surcharge?: number
  quotationDate?: string
  confidence?: number
}

export type ParametricQuoteResult = {
  productId: number
  currency: string
  width: number
  height: number
  area: number
  total: number
  breakdown: {
    base: number
    color: number
    glass: number
    monoblock: number
    mosquitoNet: number
  }
  referenceDate: string
  confidence: number
  dataVersion: string
  source?: string
  modifiers: ParametricModifierSnapshot[]
}

export type ParametricImportSummary = {
  batchId: number
  rowsProcessed: number
  referencesInserted: number
  modifiersInserted: number
  warnings: string[]
}
