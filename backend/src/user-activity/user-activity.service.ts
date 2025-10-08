import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { createHash } from 'crypto'

// ---------- Enum local (independiente de Prisma) ----------
type UserActivityType =
  | 'LOGIN'
  | 'DEVICE_SIGN_IN'
  | 'PROFILE_UPDATE'
  | 'PASSWORD_CHANGE'

const Activity: Record<UserActivityType, UserActivityType> = {
  LOGIN: 'LOGIN',
  DEVICE_SIGN_IN: 'DEVICE_SIGN_IN',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
}

// ----------------------------------------------------------

type MetadataRecord = Record<string, string | null | undefined>

type LogActivityInput = {
  userId: number
  type: UserActivityType
  description?: string | null
  // Acepta JSON arbitrario; lo normalizamos antes de persistir
  metadata?: Prisma.JsonValue
  ipAddress?: string | null
  userAgent?: string | null
  performedAt?: Date
  deviceFingerprint?: string | null
  deviceName?: string | null
  location?: string | null
  deviceType?: 'Desktop' | 'Mobile' | 'Tablet'
}

type DeviceResolution = {
  fingerprint: string | null
  displayName: string | null
  browser: string | null
  platform: string | null
  deviceType: 'Desktop' | 'Mobile' | 'Tablet'
}

type DeviceEnsureResult = {
  deviceId: number | null
  isNew: boolean
}

@Injectable()
export class UserActivityService {
  constructor(private prisma: PrismaService) {}

  async recordLogin(userId: number, req: FastifyRequest) {
    const { ipAddress, userAgent, location } = this.extractClientContext(req)
    const deviceInfo = this.resolveDevice(userId, userAgent)
    const { deviceId, isNew } = await this.ensureDevice(userId, {
      fingerprint: deviceInfo.fingerprint,
      displayName: deviceInfo.displayName,
      userAgent,
      ipAddress,
      location,
      deviceType: deviceInfo.deviceType,
    })

    const metadata = this.normalizeMetadata({
      device: deviceInfo.displayName,
      browser: deviceInfo.browser,
      platform: deviceInfo.platform,
      ipAddress,
      location,
    })

    await this.logActivity({
      userId,
      type: Activity.LOGIN,
      description: 'Signed in successfully.',
      metadata,
      ipAddress,
      userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      deviceName: deviceInfo.displayName,
      location,
      performedAt: new Date(),
      deviceType: deviceInfo.deviceType,
    })

    if (isNew) {
      await this.logActivity({
        userId,
        type: Activity.DEVICE_SIGN_IN,
        description: 'New device detected for this account.',
        metadata,
        ipAddress,
        userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        deviceName: deviceInfo.displayName,
        location,
        performedAt: new Date(),
        deviceType: deviceInfo.deviceType,
      })
    }

    if (deviceId) {
      await this.prisma.userActivity.updateMany({
        where: {
          userId,
          deviceId: null,
          device: null,
          // Cast controlado para no depender del tipo de enum de Prisma
          type: { in: [Activity.LOGIN, Activity.DEVICE_SIGN_IN] as any },
        },
        data: { deviceId },
      })
    }
  }

  async recordProfileUpdate(userId: number, updatedFields: string[], req?: FastifyRequest) {
    if (!updatedFields.length) return

    const context = req
      ? this.extractClientContext(req)
      : { ipAddress: null as string | null, userAgent: null as string | null, location: null as string | null }

    await this.logActivity({
      userId,
      type: Activity.PROFILE_UPDATE,
      description: 'Profile information updated.',
      metadata: this.normalizeMetadata({
        fields: updatedFields.join(', '),
        ipAddress: context.ipAddress ?? null,
      }),
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      location: context.location ?? null,
    })
  }

  async recordPasswordChange(userId: number, method: string, req: FastifyRequest) {
    const { ipAddress, userAgent, location } = this.extractClientContext(req)
    await this.logActivity({
      userId,
      type: Activity.PASSWORD_CHANGE,
      description: 'Password updated successfully.',
      metadata: this.normalizeMetadata({
        method,
        ipAddress,
        location,
      }),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      location: location ?? null,
    })
  }

  private async logActivity(input: LogActivityInput) {
    const metadata = this.normalizeMetadata(
      (input.metadata ?? undefined) as Prisma.JsonObject | MetadataRecord | undefined,
    )

    const deviceResult =
      input.deviceFingerprint && input.deviceName
        ? await this.ensureDevice(input.userId, {
            fingerprint: input.deviceFingerprint,
            displayName: input.deviceName,
            userAgent: input.userAgent ?? null,
            ipAddress: input.ipAddress ?? null,
            location: input.location ?? null,
            deviceType: input.deviceType ?? 'Desktop',
          })
        : { deviceId: null, isNew: false }

    await this.prisma.userActivity.create({
      data: {
        userId: input.userId,
        // Cast controlado: al regenerar Prisma podrás quitar el `as any`
        type: input.type as any,
        description: input.description ?? null,
        metadata, // Prisma.JsonObject | undefined
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        performedAt: input.performedAt ?? new Date(),
        deviceId: deviceResult.deviceId ?? undefined,
      },
    })
  }

  private async ensureDevice(
    userId: number,
    input: {
      fingerprint: string | null
      displayName: string | null
      userAgent: string | null
      ipAddress: string | null
      location: string | null
      deviceType: 'Desktop' | 'Mobile' | 'Tablet'
    },
  ): Promise<DeviceEnsureResult> {
    if (!input.fingerprint) {
      return { deviceId: null, isNew: false }
    }

    const now = new Date()
    const existing = await this.prisma.userDevice.findUnique({
      where: { fingerprint: input.fingerprint },
    })
    if (existing) {
      const updated = await this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName ?? existing.displayName,
          userAgent: input.userAgent ?? existing.userAgent,
          lastIpAddress: input.ipAddress ?? existing.lastIpAddress,
          location: input.location ?? existing.location,
          lastSeenAt: now,
          deviceType: input.deviceType ?? existing.deviceType ?? 'Desktop',
        },
      })
      return { deviceId: updated.id, isNew: false }
    }

    const created = await this.prisma.userDevice.create({
      data: {
        userId,
        fingerprint: input.fingerprint,
        displayName: input.displayName,
        userAgent: input.userAgent,
        lastIpAddress: input.ipAddress,
        location: input.location,
        firstSeenAt: now,
        lastSeenAt: now,
        deviceType: input.deviceType,
      },
    })
    return { deviceId: created.id, isNew: true }
  }

  private extractClientContext(req: FastifyRequest) {
    const forwarded = this.getHeader(req, 'x-forwarded-for')
    const xReal = this.getHeader(req, 'x-real-ip')
    const ipHeader = forwarded || xReal
    const ipAddress = ipHeader ? ipHeader.split(',')[0].trim() : (req.ip || null)
    const userAgent = this.getHeader(req, 'user-agent') || null
    const location = this.getHeader(req, 'x-app-location') || null
    return { ipAddress, userAgent, location }
  }

  private getHeader(req: FastifyRequest, key: string) {
    const headers = req.headers as Record<string, unknown>
    const value = headers[key] ?? headers[key.toLowerCase()]
    if (Array.isArray(value)) {
      return value[0]
    }
    return typeof value === 'string' ? value : undefined
  }

  private resolveDevice(userId: number, userAgent: string | null): DeviceResolution {
    if (!userAgent) {
      return {
        fingerprint: this.computeFingerprint(userId, 'unknown'),
        displayName: 'Unknown device',
        browser: 'Unknown',
        platform: 'Unknown',
        deviceType: 'Desktop',
      }
    }

    const ua = userAgent.toLowerCase()

    let browser: string | null = null
    if (ua.includes('edg/')) browser = 'Edge'
    else if (ua.includes('chrome')) browser = 'Chrome'
    else if (ua.includes('safari')) browser = 'Safari'
    else if (ua.includes('firefox')) browser = 'Firefox'
    else if (ua.includes('msie') || ua.includes('trident')) browser = 'Internet Explorer'

    let platform: string | null = null
    let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop'
    if (ua.includes('iphone') || (ua.includes('android') && ua.includes('mobile'))) {
      platform = 'iOS / Android'
      deviceType = 'Mobile'
    } else if (ua.includes('ipad') || ua.includes('tablet')) {
      platform = 'Tablet'
      deviceType = 'Tablet'
    } else if (ua.includes('mac os')) {
      platform = 'macOS'
    } else if (ua.includes('windows')) {
      platform = 'Windows'
    } else if (ua.includes('linux')) {
      platform = 'Linux'
    }

    const displayNameParts: string[] = []
    if (browser) displayNameParts.push(browser)
    if (platform) displayNameParts.push(`on ${platform}`)
    const displayName = displayNameParts.length ? displayNameParts.join(' ') : 'Unknown device'

    return {
      fingerprint: this.computeFingerprint(userId, userAgent),
      displayName,
      browser,
      platform,
      deviceType,
    }
  }

  private computeFingerprint(userId: number, userAgent: string | null) {
    if (!userAgent) {
      return null
    }
    return createHash('sha256').update(`${userId}:${userAgent}`).digest('hex')
  }

  private normalizeMetadata(
    metadata?: MetadataRecord | Prisma.JsonObject,
  ): Prisma.JsonObject | undefined {
    if (!metadata) return undefined

    const entries = Object.entries(metadata).filter(([, value]) => {
      if (value === undefined || value === null) return false
      if (typeof value === 'string') return value.trim().length > 0
      return true // números/booleanos/objetos/arreglos permitidos si el campo es JSON
    })

    if (!entries.length) return undefined
    return Object.fromEntries(entries) as Prisma.JsonObject
  }
}