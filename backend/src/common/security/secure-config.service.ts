import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigEncryptionService } from './config-encryption.service'

type SecureConfigRecord<T> = { value: T; updatedAt: Date }

@Injectable()
export class SecureConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: ConfigEncryptionService,
  ) {}

  async getString(key: string): Promise<SecureConfigRecord<string> | null> {
    const record = await this.prisma.secureConfig.findUnique({ where: { key } })
    if (!record) {
      return null
    }

    const decrypted = this.encryption.decrypt(record.value)
    return { value: decrypted, updatedAt: record.updatedAt }
  }

  async getJson<T>(key: string): Promise<SecureConfigRecord<T> | null> {
    const record = await this.getString(key)
    if (!record) {
      return null
    }

    return {
      value: JSON.parse(record.value) as T,
      updatedAt: record.updatedAt,
    }
  }

  async setString(key: string, value: string | null): Promise<void> {
    if (value === null) {
      try {
        await this.prisma.secureConfig.delete({ where: { key } })
      } catch (error: any) {
        if (error?.code !== 'P2025') {
          throw error
        }
      }
      return
    }

    const encrypted = this.encryption.encrypt(value)
    await this.prisma.secureConfig.upsert({
      where: { key },
      update: { value: encrypted },
      create: { key, value: encrypted },
    })
  }

  async setJson<T>(key: string, payload: T | null): Promise<void> {
    if (payload === null) {
      await this.setString(key, null)
      return
    }
    const serialized = JSON.stringify(payload)
    await this.setString(key, serialized)
  }
}
