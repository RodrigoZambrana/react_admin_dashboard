import type { Prisma } from '@prisma/client'
import type { PrismaService } from '../prisma/prisma.service'

export type PrismaClientOrTransaction = PrismaService | Prisma.TransactionClient

export type ParametricMatrixRow = {
  fingerprint?: string
  optionState?: string
  familyId: string
  serie: string
  material: string
  color: string
  vidrio: string
  widthMm: number
  heightMm: number
  hasMosquitero: boolean
  hasShutterMonoblock: boolean
  shutterMaterial: string
  price: number
  priceBase?: number | null
  priceMosquitero?: number | null
  priceMonoblock?: number | null
  priceMonoblockMosquitero?: number | null
  hasMosquiteroOption?: boolean
  hasMonoblockOption?: boolean
  currency: string
  detailSnapshot?: string | null
  specifications?: string | null
  source?: string | null
  sourceSystem?: string | null
  referenceDate?: Date | null
}

export type ParametricPriceLineageEntry = {
  source?: string | null
  referenceDate?: string | null
}

export type ParametricPriceLineage = {
  priceBase?: ParametricPriceLineageEntry
  priceMosquitero?: ParametricPriceLineageEntry
  priceMonoblock?: ParametricPriceLineageEntry
  priceMonoblockMosquitero?: ParametricPriceLineageEntry
}

export type ParametricMatrixEntry = {
  id: number
  familyId: string
  serie: string
  material: string
  color: string
  vidrio: string
  widthMm: number
  heightMm: number
  price: number
  priceBase: number | null
  priceMosquitero: number | null
  priceMonoblock: number | null
  priceMonoblockMosquitero: number | null
  hasMosquiteroOption: boolean
  hasMonoblockOption: boolean
  shutterMaterial: string
  currency: string
  detailSnapshot: string | null
  specifications: string | null
  priceLineage: ParametricPriceLineage | null
  conflictFlags: string[]
  source: string | null
  referenceDate: string | null
}

export type ParametricQuoteInput = {
  productId: number
  familyId?: string | null
  serie: string
  material: string
  color: string
  vidrio: string
  widthMm: number
  heightMm: number
  hasMosquitero: boolean
  hasShutterMonoblock: boolean
  shutterMaterial?: string | null
}

export type ParametricQuoteResult = {
  productId: number
  available: boolean
  price?: number
  currency?: string
  detailSnapshot?: string | null
  specifications?: string | null
  source?: string | null
  referenceDate?: string | null
  matrixRowId?: number
  requested: {
    familyId?: string | null
    serie: string
    material: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
    hasMosquitero: boolean
    hasShutterMonoblock: boolean
    shutterMaterial: string
  }
}

export type ParametricImportSummary = {
  rowsInserted: number
  rowsUpdated: number
  warnings: string[]
}

export type ParametricProductImportSummary = {
  productsCreated: number
  productsUpdated: number
  matrixRows: number
  warnings: string[]
}

export type ParametricCompatibilityConfig = {
  glassBySeries?: Record<string, string[]>
  monoblockBySeries?: Record<string, boolean>
  sizeLimits?: Record<
    string,
    {
      minWidthMm?: number
      maxWidthMm?: number
      minHeightMm?: number
      maxHeightMm?: number
    }
  >
}

export type ParametricConfigSnapshot = {
  selectors: {
    families: string[]
    series: string[]
    materials: string[]
    colors: string[]
    glass: string[]
    widths: number[]
    heights: number[]
    shutterMaterials: string[]
    hasMosquiteroOption: boolean
    hasMonoblockOption: boolean
  }
  stats: {
    rowCount: number
    minimumPrice?: number
    currency?: string
    newestReferenceDate?: string | null
    oldestReferenceDate?: string | null
  }
  compatibility: ParametricCompatibilityConfig
}
