import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

@Injectable()
export class ConfigEncryptionService {
  private readonly logger = new Logger(ConfigEncryptionService.name)
  private readonly key: Buffer

  constructor(private readonly config: ConfigService) {
    const raw = (this.config.get<string>('CONFIG_ENCRYPTION_KEY') ?? '').trim()

    if (!raw) {
      throw new InternalServerErrorException(
        'CONFIG_ENCRYPTION_KEY must be configured to use secure settings storage.',
      )
    }

    this.key = this.deriveKey(raw)
  }

  encrypt(value: string): string {
    try {
      const iv = randomBytes(IV_LENGTH)
      const cipher = createCipheriv(AES_ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH })
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
      const authTag = cipher.getAuthTag()
      return Buffer.concat([iv, authTag, encrypted]).toString('base64')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to encrypt secure config value: ${message}`)
      throw new InternalServerErrorException('Unable to secure configuration value.')
    }
  }

  decrypt(payload: string): string {
    try {
      const buffer = Buffer.from(payload, 'base64')
      const iv = buffer.subarray(0, IV_LENGTH)
      const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
      const data = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
      const decipher = createDecipheriv(AES_ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH })
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
      return decrypted.toString('utf8')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to decrypt secure config value: ${message}`)
      throw new InternalServerErrorException('Unable to read secure configuration value.')
    }
  }

  private deriveKey(secret: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(secret)) {
      return Buffer.from(secret, 'hex')
    }

    try {
      const decoded = Buffer.from(secret, 'base64')
      if (decoded.length >= 32) {
        return decoded.subarray(0, 32)
      }
    } catch {
      // Ignore, fallthrough to other strategies.
    }

    const utf8 = Buffer.from(secret, 'utf8')
    if (utf8.length >= 32) {
      return utf8.subarray(0, 32)
    }

    // Fallback to a SHA-256 hash to derive a 32-byte key.
    return createHash('sha256').update(utf8).digest()
  }
}
