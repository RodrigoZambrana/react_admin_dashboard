import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class UpdateWhatsappQrConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  displayName?: string | null

  @IsOptional()
  @IsString()
  address?: string | null

  @IsOptional()
  @IsBoolean()
  autoStart?: boolean

  @IsOptional()
  @IsBoolean()
  typingIndicatorEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  presenceIndicatorEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  humanDelayEnabled?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300000)
  minReplyDelayMs?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300000)
  maxReplyDelayMs?: number | null

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxOutboundPerHour?: number | null

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxOutboundPerDay?: number | null

  @IsOptional()
  @IsBoolean()
  reactionsEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  readReceiptsEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  allowProactiveOutbound?: boolean

  @IsOptional()
  @IsString()
  quietHoursStart?: string | null

  @IsOptional()
  @IsString()
  quietHoursEnd?: string | null
}
