import {
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
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

export class UpdateWhatsappQrChannelControlDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsBoolean()
  autoStart?: boolean;

  @IsOptional()
  @IsBoolean()
  typingIndicatorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  presenceIndicatorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  humanDelayEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300000)
  minReplyDelayMs?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300000)
  maxReplyDelayMs?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxOutboundPerHour?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxOutboundPerDay?: number | null;

  @IsOptional()
  @IsBoolean()
  reactionsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  readReceiptsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowProactiveOutbound?: boolean;

  @IsOptional()
  @IsString()
  quietHoursStart?: string | null;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelRouteDefaultsDto)
  route?: ChannelRouteDefaultsDto;
}
