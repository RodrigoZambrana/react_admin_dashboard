import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { ParametricPricingService } from './parametric-pricing.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import type { ParametricQuoteInput } from './types'
import { ParametricFeatureGuard } from './pricing.guard'

type AuthenticatedRequest = FastifyRequest & {
  user?: {
    id?: number
  }
}

@Controller('pricing')
@UseGuards(JwtAuthGuard, ParametricFeatureGuard)
export class PricingController {
  constructor(private readonly pricing: ParametricPricingService) {}

  @Get('products/:productId/config')
  getConfig(@Param('productId', ParseIntPipe) productId: number) {
    return this.pricing.getProductConfig(productId)
  }

  @Post('quote')
  quote(@Body() body: ParametricQuoteInput) {
    return this.pricing.quote(body)
  }

  @Post('products/:productId/import')
  async importPrices(
    @Param('productId', ParseIntPipe) productId: number,
    @Req() req: FastifyRequest,
  ) {
    const file = await (req as any)?.file?.()
    if (!file) {
      throw new Error('File is required')
    }
    const buffer = await file.toBuffer()
    const userId = (req as AuthenticatedRequest).user?.id
    return this.pricing.importFromBuffer(productId, buffer, {
      filename: file.filename,
      userId,
    })
  }
}
