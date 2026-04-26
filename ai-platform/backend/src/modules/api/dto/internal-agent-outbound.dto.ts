import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class InternalAgentToolCallDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsObject()
  arguments?: Record<string, unknown>;

  @IsOptional()
  result?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  errorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  errorMessage?: string;
}

export class InternalAgentOutboundDto {
  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  finalUserText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  debugSummary?: string;

  @IsOptional()
  @IsObject()
  auditPayload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InternalAgentToolCallDto)
  toolCalls?: InternalAgentToolCallDto[];

  @IsOptional()
  @IsBoolean()
  needsHuman?: boolean;

  @IsOptional()
  @IsObject()
  grounding?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  audit?: Record<string, unknown>;
}
