import { BadRequestException, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { Throttle } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import { MediaUploadType } from './media.dto'
import { persistLocalProductMediaFile, StoredProductMediaRecord } from '../common/uploads/product-media'
import { isCloudinaryMediaProvider } from '../common/media/media-provider'
import { PrismaService } from '../prisma/prisma.service'
import { buildProductSlug } from '../storefront/utils'

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async upload(
    @Req() req: FastifyRequest,
  ): Promise<StoredProductMediaRecord> {
    if (isCloudinaryMediaProvider()) {
      throw new BadRequestException('media.provider.cloudinaryEnabled')
    }

    const { fields, file } = await parseSingleFileMultipart(req)
    if (!file) {
      throw new BadRequestException('media.validation.fileRequired')
    }

    const productId = Number.parseInt(String(fields.productId ?? '').trim(), 10)
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new BadRequestException('media.validation.invalidProduct')
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        productCode: true,
      },
    })
    if (!product) {
      throw new BadRequestException('media.validation.invalidProduct')
    }
    const productSlug = buildProductSlug(product.id, product.name, product.productCode ?? undefined)

    const rawType = String(fields.type ?? '').trim().toLowerCase()
    const type = rawType === MediaUploadType.VIDEO ? 'video' : rawType === MediaUploadType.IMAGE ? 'image' : null
    if (!type) {
      throw new BadRequestException('media.validation.invalidType')
    }

    const rawOrder = Number.parseInt(String(fields.order ?? '0').trim(), 10)
    const order = Number.isFinite(rawOrder) ? rawOrder : 0
    const alt = String(fields.alt ?? '').trim() || undefined

    return persistLocalProductMediaFile(file, {
      productSlug,
      type,
      order,
      alt,
    })
  }
}
