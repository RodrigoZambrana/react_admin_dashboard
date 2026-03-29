import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { ConversationMessageAttachmentDto } from './conversation-message-attachment.dto'

const conversationChannels = [
  'email',
  'whatsapp',
  'facebook',
  'instagram',
] as const

const historyAuthorKinds = [
  'customer_human',
  'business_human',
  'business_auto',
  'channel_system',
  'operator_human',
  'agent_runtime',
  'unknown',
] as const

const historyMessageKinds = [
  'human_message',
  'business_auto_reply',
  'channel_system',
  'attachment_only',
  'system_event',
] as const

const historyDirections = ['inbound', 'outbound'] as const

export class ImportChannelHistoryMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  tenantKey!: string

  @IsIn(conversationChannels)
  channel!: (typeof conversationChannels)[number]

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  userId!: string

  @IsIn(historyDirections)
  direction!: (typeof historyDirections)[number]

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  conversationId?: string

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
  subject?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  threadId?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  externalMessageId?: string

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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(10000)
  text?: string

  @IsOptional()
  @Type(() => Date)
  occurredAt?: Date

  @IsOptional()
  @IsIn(historyAuthorKinds)
  authorKind?: (typeof historyAuthorKinds)[number]

  @IsOptional()
  @IsIn(historyMessageKinds)
  messageKind?: (typeof historyMessageKinds)[number]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageAttachmentDto)
  attachments?: ConversationMessageAttachmentDto[]
}
