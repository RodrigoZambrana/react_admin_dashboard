import { Transform } from 'class-transformer'
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
} from 'class-validator'
import { Type } from 'class-transformer'

class AgentToolCallDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name!: string

  @IsOptional()
  @IsObject()
  arguments?: Record<string, unknown>

  @IsOptional()
  result?: unknown

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  status?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  errorCode?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  errorMessage?: string
}

export class AgentReplyDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  body!: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentToolCallDto)
  toolCalls?: AgentToolCallDto[]
}
