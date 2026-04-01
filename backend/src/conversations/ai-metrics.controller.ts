import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { ConversationsService } from './conversations.service'
import { GetAiMetricsDto } from './dto/get-ai-metrics.dto'

@Controller('metrics')
export class AiMetricsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get('ai')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
  getAiMetrics(
    @Query() query: GetAiMetricsDto,
    @Req() _req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.conversations.getAiMetrics(query)
  }
}
