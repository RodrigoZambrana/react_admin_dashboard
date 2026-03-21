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
import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { ParametricPricingService } from './parametric-pricing.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequestTimeout } from '../common/decorators/request-timeout.decorator'
import type {
  ParametricCompatibilityConfig,
  ParametricMatrixSearchDto,
  ParametricManualMatrixInput,
  ParametricQuoteInput,
} from './types'
import { ParametricFeatureGuard } from './pricing.guard'

const DEFAULT_PARAMETRIC_IMPORT_TIMEOUT_MS = 2 * 60 * 1000
const PARAMETRIC_IMPORT_TIMEOUT_MS = (() => {
  const parsed = Number(process.env.PARAMETRIC_IMPORT_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PARAMETRIC_IMPORT_TIMEOUT_MS
})()

class ManualMatrixDto implements ParametricManualMatrixInput {
  @IsString()
  familyId!: string

  @IsString()
  serie!: string

  @IsString()
  color!: string

  @IsString()
  vidrio!: string

  @IsNumber()
  @Type(() => Number)
  widthMm!: number

  @IsNumber()
  @Type(() => Number)
  heightMm!: number

  @IsOptional()
  @IsBoolean()
  hasMosquitero?: boolean

  @IsOptional()
  @IsBoolean()
  hasMonoblock?: boolean

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priceBase?: number | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priceMosquitero?: number | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pricePvcShutter?: number | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pricePvcShutterMosq?: number | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priceAluminioShutter?: number | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priceAluminioShutterMosq?: number | null
}

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

  @Get('products/:productId/manual-config')
  getManualConfig(@Param('productId', ParseIntPipe) productId: number) {
    return this.pricing.getManualConfigSnapshot(productId)
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

  @Put('products/:productId/manual-config')
  upsertManualConfig(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() payload: ManualMatrixDto,
  ) {
    return this.pricing.saveManualConfig(productId, payload)
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
    res.header('Content-Type', 'text/csv; charset=utf-8')
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
    return this.pricing.importParametricProductsFromCsv(buffer, {
      filename: file.filename,
    })
  }
}
