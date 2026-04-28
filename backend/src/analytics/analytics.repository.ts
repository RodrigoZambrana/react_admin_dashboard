import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import type { AnalyticsEventInput } from './analytics.types'

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveEvent(input: AnalyticsEventInput) {
    const payload = JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
    return this.prisma.analyticsEvent.create({
      data: {
        eventName: input.event,
        sessionId: input.session_id,
        url: input.url,
        userAgent: input.user_agent,
        referrer: input.referrer ?? null,
        correlationId: input.correlation_id ?? null,
        userId: input.user_id ?? null,
        timestamp: new Date(input.timestamp),
        payload,
      },
    })
  }

  async listEvents(from: Date, to: Date, eventNames?: string[]) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        timestamp: {
          gte: from,
          lte: to,
        },
        ...(eventNames && eventNames.length
          ? {
              eventName: {
                in: eventNames,
              },
            }
          : {}),
      },
      orderBy: {
        timestamp: 'asc',
      },
    })
  }

  async listUnprocessedEvents(limit = 1000) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        processed: false,
      },
      orderBy: {
        timestamp: 'asc',
      },
      take: limit,
    })
  }

  async listEventsInRange(from: Date, to: Date, limit = 1000, cursorId?: string) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        timestamp: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take: limit,
    })
  }

  async markEventsProcessed(ids: string[], processedAt = new Date()) {
    if (!ids.length) {
      return { count: 0 }
    }

    return this.prisma.analyticsEvent.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        processed: true,
        processedAt,
      },
    })
  }

  async upsertSession(input: {
    id: string
    firstSeen: Date
    lastSeen: Date
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    referrer?: string | null
  }) {
    const existing = await this.prisma.analyticsSession.findUnique({
      where: {
        id: input.id,
      },
    })

    if (!existing) {
      return this.prisma.analyticsSession.create({
        data: {
          id: input.id,
          firstSeen: input.firstSeen,
          lastSeen: input.lastSeen,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          referrer: input.referrer ?? null,
        },
      })
    }

    const firstSeen = existing.firstSeen && existing.firstSeen < input.firstSeen ? existing.firstSeen : input.firstSeen
    const lastSeen = existing.lastSeen && existing.lastSeen > input.lastSeen ? existing.lastSeen : input.lastSeen

    return this.prisma.analyticsSession.update({
      where: {
        id: input.id,
      },
      data: {
        firstSeen,
        lastSeen,
        utmSource: existing.utmSource ?? input.utmSource ?? null,
        utmMedium: existing.utmMedium ?? input.utmMedium ?? null,
        utmCampaign: existing.utmCampaign ?? input.utmCampaign ?? null,
        referrer: existing.referrer ?? input.referrer ?? null,
      },
    })
  }

  async upsertManyFacts(records: Prisma.EventFactCreateManyInput[]) {
    if (!records.length) {
      return { count: 0 }
    }

    return this.prisma.eventFact.createMany({
      data: records,
      skipDuplicates: true,
    })
  }

  async getEventFactFunnel(from: Date, to: Date, steps: string[]) {
    const facts = await this.prisma.eventFact.findMany({
      where: {
        eventDate: {
          gte: from,
          lte: to,
        },
        eventName: {
          in: steps,
        },
      },
      select: {
        eventName: true,
        sessionId: true,
      },
    })

    const totals = new Map<string, { sessions: Set<string>; events: number }>()
    for (const step of steps) {
      totals.set(step, { sessions: new Set<string>(), events: 0 })
    }
    for (const fact of facts) {
      const current = totals.get(fact.eventName)
      if (!current) {
        continue
      }
      current.sessions.add(fact.sessionId)
      current.events += 1
    }

    return totals
  }

  async getSessionCountsByChannel(from: Date, to: Date) {
    return this.prisma.analyticsSession.findMany({
      where: {
        lastSeen: {
          gte: from,
          lte: to,
        },
      },
      select: {
        utmSource: true,
        id: true,
      },
    })
  }

  async getOrdersInRange(from: Date, to: Date) {
    return this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        uuid: true,
        grandTotal: true,
        orderCurrency: true,
        createdAt: true,
        sessionId: true,
        userId: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        referrer: true,
        items: {
          select: {
            productId: true,
            name: true,
            qty: true,
            price: true,
          },
        },
      },
    })
  }

  async getProductFacts(from: Date, to: Date) {
    return this.prisma.eventFact.findMany({
      where: {
        eventDate: {
          gte: from,
          lte: to,
        },
        productId: {
          not: null,
        },
      },
      select: {
        eventName: true,
        productId: true,
        value: true,
      },
    })
  }
}
