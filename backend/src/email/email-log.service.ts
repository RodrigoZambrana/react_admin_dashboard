import { Injectable } from '@nestjs/common'
import { EmailCategory, EmailLogStatus, EmailRecipientType, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { maskEmailAddress, maskEmailList } from '../common/privacy/masking'

export type EmailLogFilter = {
  category?: EmailCategory
  status?: EmailLogStatus
  recipientType?: EmailRecipientType
  take?: number
  cursor?: number | null
  search?: string | null
  fromDate?: Date | null
  toDate?: Date | null
}

@Injectable()
export class EmailLogService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeLog<T extends { toAddress: string; ccAddresses: string[]; bccAddresses: string[] }>(log: T): T {
    return {
      ...log,
      toAddress: maskEmailAddress(log.toAddress),
      ccAddresses: maskEmailList(log.ccAddresses),
      bccAddresses: maskEmailList(log.bccAddresses),
    }
  }

  async listLogs(filter: EmailLogFilter) {
    const take = Math.min(Math.max(filter.take ?? 25, 1), 100)
    const where: Prisma.EmailLogWhereInput = {}
    if (filter.category) {
      where.category = filter.category
    }
    if (filter.status) {
      where.status = filter.status
    }
    if (filter.recipientType) {
      where.recipientType = filter.recipientType
    }
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {}
      if (filter.fromDate) {
        where.createdAt.gte = filter.fromDate
      }
      if (filter.toDate) {
        where.createdAt.lte = filter.toDate
      }
    }
    if (filter.search) {
      const query = filter.search.trim().toLowerCase()
      if (query) {
        where.OR = [
          { toAddress: { contains: query, mode: 'insensitive' } },
          { subject: { contains: query, mode: 'insensitive' } },
          { providerMessageId: { contains: query, mode: 'insensitive' } },
        ]
      }
    }

    const logs = await this.prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      cursor: filter.cursor ? { id: filter.cursor } : undefined,
    })
    let nextCursor: number | null = null
    if (logs.length > take) {
      const next = logs.pop()
      nextCursor = next ? next.id : null
    }
    return {
      logs: logs.map((log) => this.sanitizeLog(log)),
      nextCursor,
    }
  }

  async getLog(id: number) {
    const log = await this.prisma.emailLog.findUnique({ where: { id } })
    return log ? this.sanitizeLog(log) : null
  }
}
