import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OpenAiUsageService } from './openai-usage.service'

@Controller('usage')
export class UsageController {
  constructor(
    private readonly usage: OpenAiUsageService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getUsage(
    @Query('start_time') startTime?: string,
    @Query('end_time') endTime?: string,
    @Query('api_key_ids') apiKeyIds?: string | string[],
  ) {
    return this.usage.getUsageSnapshot({
      startTime: this.parseNumericQuery(startTime),
      endTime: this.parseNumericQuery(endTime),
      apiKeyIds: this.parseApiKeyIds(apiKeyIds),
    }).then((snapshot) => ({
      usage: {
        tokens: snapshot.usage.total_tokens,
        requests: snapshot.usage.total_requests,
        start_time: snapshot.usage.start_time,
        end_time: snapshot.usage.end_time,
        source: snapshot.usage.source,
        error: snapshot.usage.error,
      },
      costs: {
        total_spent: snapshot.costs.total_spent,
        currency: snapshot.costs.currency,
        start_time: snapshot.costs.start_time,
        end_time: snapshot.costs.end_time,
        source: snapshot.costs.source,
        error: snapshot.costs.error,
      },
      quota: {
        total_spent: snapshot.quota.total_spent,
        budget_limit: snapshot.quota.budget_limit,
        remaining: snapshot.quota.remaining,
        exceeded: snapshot.quota.exceeded,
        source: snapshot.quota.source,
        error: snapshot.quota.error,
        checked_at: snapshot.quota.checked_at,
      },
    }))
  }

  @Get('internal')
  getUsageInternal(
    @Headers('x-ai-internal-token') token?: string,
    @Query('start_time') startTime?: string,
    @Query('end_time') endTime?: string,
    @Query('api_key_ids') apiKeyIds?: string | string[],
  ) {
    this.assertInternalToken(token)
    return this.usage.getUsageSnapshot({
      startTime: this.parseNumericQuery(startTime),
      endTime: this.parseNumericQuery(endTime),
      apiKeyIds: this.parseApiKeyIds(apiKeyIds),
    })
  }

  private parseNumericQuery(value?: string) {
    if (!value) {
      return undefined
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private parseApiKeyIds(value?: string | string[]) {
    if (!value) {
      return []
    }
    const items = Array.isArray(value) ? value : [value]
    return items
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  private assertInternalToken(token?: string) {
    const expected =
      this.config.get<string>('AI_INTERNAL_TOKEN') || 'local-ai-internal-token'
    if (token !== expected) {
      throw new UnauthorizedException('Invalid AI internal token')
    }
  }
}
