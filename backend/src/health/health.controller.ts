import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get(['health', 'healthz'])
  async health() {
    let db = false
    try {
      // Simple DB check
      await this.prisma.$queryRaw`SELECT 1`
      db = true
    } catch (_) {
      db = false
    }
    return {
      status: 'ok',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}

