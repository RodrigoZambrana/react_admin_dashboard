import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
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

export class UpdateMetaChannelControlDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  messengerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  instagramEnabled?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false })
  publicBaseUrl?: string | null;

  @IsOptional()
  @IsString()
  pageId?: string | null;

  @IsOptional()
  @IsString()
  instagramBusinessAccountId?: string | null;

  @IsOptional()
  @IsString()
  appId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelSecretRefDto)
  verifyTokenRef?: ChannelSecretRefDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelSecretRefDto)
  appSecretRef?: ChannelSecretRefDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelSecretRefDto)
  pageAccessTokenRef?: ChannelSecretRefDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelSecretRefDto)
  messengerPageAccessTokenRef?: ChannelSecretRefDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelSecretRefDto)
  instagramAccessTokenRef?: ChannelSecretRefDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelRouteDefaultsDto)
  route?: ChannelRouteDefaultsDto;
}
