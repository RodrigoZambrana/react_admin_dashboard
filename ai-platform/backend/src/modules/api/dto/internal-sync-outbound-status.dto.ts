import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class InternalSyncOutboundStatusDto {
  @IsString()
  conversationId!: string;

  @IsString()
  remoteId!: string;

  @IsString()
  @IsIn(['email', 'whatsapp', 'facebook', 'instagram'])
  channel!: 'email' | 'whatsapp' | 'facebook' | 'instagram';

  @IsString()
  @IsIn(['queued', 'accepted', 'sent', 'delivered', 'read', 'failed', 'rejected'])
  deliveryStatus!: 'queued' | 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | 'rejected';

  @IsOptional()
  @IsString()
  inboxAccountId?: string;

  @IsOptional()
  @IsString()
  externalMessageId?: string;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
