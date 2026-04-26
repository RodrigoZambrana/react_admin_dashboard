import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class InternalAgentTurnDto {
  @IsString()
  @MaxLength(10000)
  message!: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
