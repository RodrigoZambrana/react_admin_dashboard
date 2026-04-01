import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { ConversationMessageAttachmentDto } from './conversation-message-attachment.dto'

export class DispatchWebchatMessageDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  tenantKey?: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  conversationId!: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  guestId!: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  userId?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(['customer_public', 'customer_authenticated'])
  scope?: 'customer_public' | 'customer_authenticated'

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  authenticated?: boolean

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  text?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(16)
  locale?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageAttachmentDto)
  attachments?: ConversationMessageAttachmentDto[]
}
