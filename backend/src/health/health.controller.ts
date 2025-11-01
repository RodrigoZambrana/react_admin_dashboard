import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('/healthz')
  async liveness() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }

  @Get('/readyz')
  async readiness() {
    const db = await this.probeDatabase()
    return {
      status: db ? 'ready' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }

  @Get('/health')
  async legacyHealth() {
    const db = await this.probeDatabase()
    return {
      status: db ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }

  private async probeDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return true
    } catch (_) {
      return false
    }
  }
}
