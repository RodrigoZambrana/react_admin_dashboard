import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class InternalBootstrapChannelThreadDto {
  @IsString()
  tenantKey!: string;

  @IsIn(['email', 'whatsapp', 'facebook', 'instagram'])
  channel!: 'email' | 'whatsapp' | 'facebook' | 'instagram';

  @IsString()
  userId!: string;

  @IsString()
  threadId!: string;

  @IsOptional()
  @IsString()
  inboxAccountId?: string;

  @IsOptional()
  @IsString()
  inboxAddress?: string;

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
  @IsObject()
  metadata?: Record<string, unknown>;
}
