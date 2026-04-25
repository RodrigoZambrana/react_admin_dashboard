import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class InternalConversationAttachmentDto {
  @IsOptional()
  @IsString()
  assetType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class InternalChannelInboundMessageDto {
  @IsString()
  tenantKey!: string;

  @IsIn(['email', 'whatsapp', 'facebook', 'instagram'])
  channel!: 'email' | 'whatsapp' | 'facebook' | 'instagram';

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  inboxAccountId?: string;

  @IsOptional()
  @IsString()
  inboxAddress?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsString()
  externalMessageId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  queueSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  text?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  authorKind?: string;

  @IsOptional()
  @IsString()
  messageKind?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InternalConversationAttachmentDto)
  attachments?: InternalConversationAttachmentDto[];
}
