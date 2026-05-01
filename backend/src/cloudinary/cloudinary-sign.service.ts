import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import {
  CloudinarySignUploadDto,
  CloudinarySignUploadResponse,
  CloudinaryUploadMediaType,
} from './cloudinary-upload.dto'
import { resolveRequiredEnv } from '../common/config/runtime-env'
import { BadRequestException } from '@nestjs/common'
import { isCloudinaryMediaProvider } from '../common/media/media-provider'

const normalizeFolder = (productId: number, type: CloudinaryUploadMediaType) =>
  `products/${productId}/${type === CloudinaryUploadMediaType.VIDEO ? 'videos' : 'images'}`

const buildSignatureString = (params: Record<string, string | number>) =>
  Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&')

@Injectable()
export class CloudinarySignService {
  private readonly logger = new Logger(CloudinarySignService.name)
  private readonly cloudName: string
  private readonly apiKey: string
  private readonly apiSecret: string

  constructor(private readonly prisma: PrismaService) {
    this.cloudName = resolveRequiredEnv('CLOUDINARY_CLOUD_NAME', {
      developmentFallback: 'demo',
    })
    this.apiKey = resolveRequiredEnv('CLOUDINARY_API_KEY', {
      developmentFallback: 'demo',
    })
    this.apiSecret = resolveRequiredEnv('CLOUDINARY_API_SECRET', {
      developmentFallback: 'demo',
    })
  }

  async createUploadSignature(dto: CloudinarySignUploadDto): Promise<CloudinarySignUploadResponse> {
    if (!isCloudinaryMediaProvider()) {
      throw new BadRequestException('cloudinary.disabledByConfig')
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    })

    if (!product) {
      throw new NotFoundException('cloudinary.productNotFound')
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const folder = normalizeFolder(product.id, dto.type)
    const signatureParams = {
      folder,
      timestamp,
    }
    const signature = createHash('sha1')
      .update(`${buildSignatureString(signatureParams)}${this.apiSecret}`)
      .digest('hex')

    this.logger.debug(
      `Generated Cloudinary signature for product=${product.id} type=${dto.type} folder=${folder}`,
    )

    return {
      signature,
      timestamp,
      apiKey: this.apiKey,
      cloudName: this.cloudName,
      folder,
      resourceType: dto.type,
    }
  }
}
