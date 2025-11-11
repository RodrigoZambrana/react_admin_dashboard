import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { ParametricPricingService } from './parametric-pricing.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequestTimeout } from '../common/decorators/request-timeout.decorator'
import type {
  ParametricCompatibilityConfig,
  ParametricMatrixSearchDto,
  ParametricQuoteInput,
} from './types'
import { ParametricFeatureGuard } from './pricing.guard'

const DEFAULT_PARAMETRIC_IMPORT_TIMEOUT_MS = 2 * 60 * 1000
const PARAMETRIC_IMPORT_TIMEOUT_MS = (() => {
  const parsed = Number(process.env.PARAMETRIC_IMPORT_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PARAMETRIC_IMPORT_TIMEOUT_MS
})()

@Controller('pricing')
@UseGuards(JwtAuthGuard, ParametricFeatureGuard)
export class PricingController {
  constructor(private readonly pricing: ParametricPricingService) {}

  @Get('products/:productId/config')
  getConfig(@Param('productId', ParseIntPipe) productId: number) {
    return this.pricing.getProductConfig(productId)
  }

  @Get('products/:productId/matrix')
  getMatrix(@Param('productId', ParseIntPipe) productId: number) {
    return this.pricing.getProductMatrixEntries(productId)
  }

  @Get('products/:productId/selectors')
  getSelectors(@Param('productId', ParseIntPipe) productId: number) {
    return this.pricing.getProductSelectors(productId)
  }

  @Post('products/:productId/search')
  searchMatrix(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() payload: ParametricMatrixSearchDto,
  ) {
    return this.pricing.searchMatrix(productId, payload)
  }

  @Post('products/search')
  searchMatrixDefault(@Body() payload: ParametricMatrixSearchDto) {
    return this.pricing.searchMatrixDefault(payload)
  }

  @Get('products/:productId/compatibility')
  getCompatibility(@Param('productId', ParseIntPipe) productId: number) {
    return this.pricing.getCompatibility(productId)
  }

  @Put('products/:productId/compatibility')
  updateCompatibility(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() payload: ParametricCompatibilityConfig,
  ) {
    return this.pricing.updateCompatibilityConfig(productId, payload)
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
    return this.pricing.importFromBuffer(productId, buffer, {
      filename: file.filename,
    })
  }

  @Get('products/:productId/export')
  async exportMatrix(
    @Param('productId', ParseIntPipe) productId: number,
    @Res() res: FastifyReply,
  ) {
    const { filename, buffer } = await this.pricing.exportToBuffer(productId)
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.header('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @RequestTimeout(PARAMETRIC_IMPORT_TIMEOUT_MS)
  @Post('products/import-full')
  async importParametricProducts(@Req() req: FastifyRequest) {
    const file = await (req as any)?.file?.()
    if (!file) {
      throw new BadRequestException('File is required')
    }
    const buffer = await file.toBuffer()
    return this.pricing.importParametricProductsFromCsv(buffer)
  }
}
