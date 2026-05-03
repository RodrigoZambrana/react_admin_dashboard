import { Body, Controller, Get, Post, Query } from '@nestjs/common'

import { ConversionsService } from './conversions.service'
import type { TrackConversionInput } from './conversions.types'

@Controller('conversions')
export class ConversionsController {
  constructor(private readonly conversionsService: ConversionsService) {}

  @Post('track')
  track(@Body() body: TrackConversionInput) {
    return this.conversionsService.track(body)
  }

  @Get('receipts')
  listReceipts(@Query() query: { limit?: string }) {
    const limit = Number(query.limit ?? 50)
    return this.conversionsService.listReceipts(Number.isFinite(limit) && limit > 0 ? limit : 50)
  }
}

