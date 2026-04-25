import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PublicWebchatAttachmentDto {
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

export class PublicWebchatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tenantKey?: string;

  @IsString()
  conversationId!: string;

  @IsString()
  @MaxLength(120)
  guestId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(['customer_public', 'customer_authenticated'])
  scope?: 'customer_public' | 'customer_authenticated';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicWebchatAttachmentDto)
  attachments?: PublicWebchatAttachmentDto[];

  @IsOptional()
  @IsBoolean()
  authenticated?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
