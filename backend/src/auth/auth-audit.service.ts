import { Injectable } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuthAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    userId?: number | null
    eventType: 'OTP_SENT' | 'OTP_VERIFIED' | 'OTP_FAILED' | 'ACCOUNT_REGISTERED' | 'PASSWORD_RESET_REQUESTED' | 'PASSWORD_RESET_COMPLETED' | 'PROVIDER_FAILURE'
    channel?: string | null
    metadata?: Record<string, unknown> | null
    req?: FastifyRequest
  }) {
    const ipAddress = input.req?.ip ?? null
    const userAgent = (input.req?.headers['user-agent'] as string | undefined) ?? null
    const securityEventTable = this.prisma as PrismaService & {
      securityEvent: {
        create: (args: {
          data: {
            userId: number | null
            eventType: string
            channel: string | null
            metadata: Record<string, unknown> | null | undefined
            ipAddress: string | null
            userAgent: string | null
          }
        }) => Promise<unknown>
      }
    }

    await securityEventTable.securityEvent.create({
      data: {
        userId: input.userId ?? null,
        eventType: input.eventType as any,
        channel: input.channel ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress,
        userAgent,
      },
    })
  }
}
