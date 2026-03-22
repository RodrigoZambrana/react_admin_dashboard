import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type FixedParametricMatrixRow = Prisma.DimensionPriceMatrixGetPayload<{
  select: {
    familyId: true
    serie: true
    material: true
    color: true
    vidrio: true
    widthMm: true
    heightMm: true
    hasMosquitero: true
    hasShutterMonoblock: true
    shutterSystem: true
    currency: true
    source: true
    referenceDate: true
    detailSnapshot: true
  }
}>

export type PublishedParametricProductDefinition = {
  configuration: Record<string, unknown>
  specifications: Array<{ label: string; value: string }>
}

@Injectable()
export class StorefrontPublishedProductResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePublishedParametricProduct(
    productId: number,
    fallbackCurrency?: string | null,
  ): Promise<PublishedParametricProductDefinition | null> {
    const row = await this.prisma.dimensionPriceMatrix.findFirst({
      where: { productId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        familyId: true,
        serie: true,
        material: true,
        color: true,
        vidrio: true,
        widthMm: true,
        heightMm: true,
        hasMosquitero: true,
        hasShutterMonoblock: true,
        shutterSystem: true,
        currency: true,
        source: true,
        referenceDate: true,
        detailSnapshot: true,
      },
    })

    if (!row) {
      return null
    }

    return {
      configuration: this.buildConfiguration(row, fallbackCurrency),
      specifications: this.buildSpecifications(row),
    }
  }

  private buildConfiguration(
    row: FixedParametricMatrixRow,
    fallbackCurrency?: string | null,
  ): Record<string, unknown> {
    return {
      familyId: row.familyId,
      serie: row.serie,
      material: row.material,
      color: row.color,
      vidrio: row.vidrio,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      hasMosquitero: row.hasMosquitero,
      hasShutterMonoblock: row.hasShutterMonoblock,
      shutterMaterial: row.shutterSystem ?? '',
      currency: row.currency ?? fallbackCurrency ?? null,
      source: row.source ?? null,
      referenceDate: row.referenceDate?.toISOString?.() ?? null,
      specifications: row.detailSnapshot ?? null,
    }
  }

  private buildSpecifications(
    row: FixedParametricMatrixRow,
  ): Array<{ label: string; value: string }> {
    const specifications: Array<{ label: string; value: string }> = [
      { label: 'Serie', value: row.serie },
      { label: 'Material', value: row.material },
      { label: 'Color', value: row.color },
      { label: 'Vidrio', value: row.vidrio },
      { label: 'Ancho', value: `${row.widthMm} mm` },
      { label: 'Alto', value: `${row.heightMm} mm` },
    ]

    if (row.hasMosquitero) {
      specifications.push({ label: 'Mosquitero', value: 'Sí' })
    }

    if (row.hasShutterMonoblock) {
      specifications.push({ label: 'Monoblock', value: row.shutterSystem || 'Sí' })
    }

    return specifications
  }
}
