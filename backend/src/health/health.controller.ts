import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
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

