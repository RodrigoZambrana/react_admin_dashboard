import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateChannelConnectionStateDto {
  @IsString()
  driver!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  connectionState!: string;

  @IsIn(['healthy', 'degraded', 'offline', 'unknown'])
  health!: 'healthy' | 'degraded' | 'offline' | 'unknown';

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsObject()
  capabilities?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  observedAt?: string;
}
