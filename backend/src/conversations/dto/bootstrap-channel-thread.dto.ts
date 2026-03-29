import { Transform } from 'class-transformer'
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator'

const conversationChannels = [
  'email',
  'whatsapp',
  'facebook',
  'instagram',
] as const

export class BootstrapChannelThreadDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  tenantKey!: string

  @IsIn(conversationChannels)
  channel!: (typeof conversationChannels)[number]

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  userId!: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  threadId!: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  inboxAccountId?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  inboxAddress?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  displayName?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  email?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  queueSlug?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
