import { IsIn, IsObject, IsOptional, IsString } from 'class-validator'

const outboundChannels = ['email', 'whatsapp', 'facebook', 'instagram'] as const
const deliveryStatuses = [
  'queued',
  'accepted',
  'sent',
  'delivered',
  'read',
  'failed',
  'rejected',
] as const

export class SyncOutboundStatusDto {
  @IsString()
  conversationId!: string

  @IsString()
  remoteId!: string

  @IsString()
  @IsIn(outboundChannels)
  channel!: (typeof outboundChannels)[number]

  @IsString()
  @IsIn(deliveryStatuses)
  deliveryStatus!: (typeof deliveryStatuses)[number]

  @IsOptional()
  @IsString()
  inboxAccountId?: string

  @IsOptional()
  @IsString()
  externalMessageId?: string

  @IsOptional()
  @IsString()
  providerMessageId?: string

  @IsOptional()
  @IsString()
  occurredAt?: string

  @IsOptional()
  @IsString()
  errorCode?: string

  @IsOptional()
  @IsString()
  errorMessage?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
