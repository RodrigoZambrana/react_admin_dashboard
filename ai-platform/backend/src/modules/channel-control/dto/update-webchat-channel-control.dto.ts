import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChannelRouteDefaultsDto {
  @IsOptional()
  @IsString()
  inboxKey?: string | null;

  @IsOptional()
  @IsString()
  queueKey?: string | null;

  @IsOptional()
  @IsIn(['customer_public', 'customer_authenticated', 'admin_internal'])
  scope?: 'customer_public' | 'customer_authenticated' | 'admin_internal';
}

export class UpdateWebchatChannelControlDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAuthenticated?: boolean;

  @IsOptional()
  @IsString()
  widgetVariant?: string;

  @IsOptional()
  @IsString()
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsBoolean()
  typingIndicatorsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  stabilizationWindowMs?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelRouteDefaultsDto)
  route?: ChannelRouteDefaultsDto;
}
