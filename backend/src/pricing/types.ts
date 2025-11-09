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

export type ParametricPriceResolution =
  | {
      available: true
      price: number
      currency: string
      estimated: boolean
      components: string[]
    }
  | {
      available: false
      reason:
        | 'missing_base'
        | 'mosq_not_allowed'
        | 'mb_not_allowed'
        | 'missing_price_mosq'
        | 'missing_price_mb'
        | 'missing_price_mbm'
        | 'shutter_material_mismatch'
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
  hasShutterMonoblock: boolean
  shutterMaterial: string
  currency: string
  detailSnapshot: string | null
  specifications: string | null
  priceLineage: ParametricPriceLineage | null
  conflictFlags: string[]
  source: string | null
  referenceDate: string | null
}

export type ParametricSelectors = {
  families: string[]
  series: string[]
  colors: string[]
  glasses: string[]
  widths: number[]
  heights: number[]
  shutterMaterials: string[]
}

export type ParametricMatrixSearchDto = {
  familyId?: string
  serie?: string
  color?: string
  vidrio?: string
  widthMm?: number
  heightMm?: number
  hasMosquitero?: boolean
  hasShutterMonoblock?: boolean
  shutterMaterial?: string
  limit?: number
}

export type ParametricMatchAdjustment = {
  priceRangeFactor: [number, number]
  note: string
}

export type ParametricMatchMetadata = {
  matchLevel: 'exact' | 'near' | 'none'
  similarityScore: number
  dimensionDistance: number
  attributeMatches: {
    family: boolean
    serie: boolean
    width: boolean
    height: boolean
    vidrio: boolean
    color: boolean
  }
  sizeDeltaMm?: {
    width: number
    height: number
  }
  glassRankDelta?: number
  suggestedAdjustment?: ParametricMatchAdjustment
}

export type ParametricMatrixMatch = {
  row: ParametricMatrixEntry
  resolution: ParametricPriceResolution
  similarity: number
  metadata?: ParametricMatchMetadata
  matchLevel: ParametricMatchMetadata['matchLevel']
  suggestedAdjustment?: ParametricMatchAdjustment
}

export type ParametricMatrixSearchResult = {
  exact?: ParametricMatrixMatch
  nearest: ParametricMatrixMatch[]
  suggestions: ParametricMatrixMatch[]
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
