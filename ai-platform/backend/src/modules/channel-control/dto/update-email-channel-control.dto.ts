import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChannelSecretRefDto {
  @IsOptional()
  @IsIn(['local', 'env'])
  strategy?: 'local' | 'env';

  @IsString()
  @MinLength(1)
  ref!: string;
}

class ChannelRouteDefaultsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  inboxKey?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  queueKey?: string | null;

  @IsOptional()
  @IsIn(['customer_public', 'customer_authenticated', 'admin_internal'])
  scope?: 'customer_public' | 'customer_authenticated' | 'admin_internal';
}

export class UpdateEmailChannelControlDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsEmail()
  address?: string | null;

  @IsOptional()
  @IsString()
  imapHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  imapPort?: number | null;

  @IsOptional()
  @IsIn(['SSL_TLS', 'STARTTLS', 'NONE'])
  imapSecurity?: 'SSL_TLS' | 'STARTTLS' | 'NONE';

  @IsOptional()
  @IsString()
  smtpHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number | null;

  @IsOptional()
  @IsIn(['SSL_TLS', 'STARTTLS', 'NONE'])
  smtpSecurity?: 'SSL_TLS' | 'STARTTLS' | 'NONE';

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelSecretRefDto)
  usernameRef?: ChannelSecretRefDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelSecretRefDto)
  passwordRef?: ChannelSecretRefDto | null;

  @IsOptional()
  @IsEmail()
  fromAddress?: string | null;

  @IsOptional()
  @IsString()
  fromName?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttachmentSizeMb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  ratePerMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pollIntervalMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pollBatchSize?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelRouteDefaultsDto)
  route?: ChannelRouteDefaultsDto;
}
