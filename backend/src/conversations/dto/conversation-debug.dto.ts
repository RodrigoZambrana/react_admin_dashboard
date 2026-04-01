import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { ConversationDebugMessageDto } from './conversation-debug-message.dto'

const CONVERSATION_DEBUG_SIMULATION_MODES = ['guest', 'authenticated'] as const
const CONVERSATION_DEBUG_KNOWLEDGE_MODES = [
  'full',
  'retrieval_disabled',
  'retrieval_only',
] as const

export class ConversationDebugDto {
  @IsOptional()
  @IsIn(CONVERSATION_DEBUG_SIMULATION_MODES)
  simulateAs?: (typeof CONVERSATION_DEBUG_SIMULATION_MODES)[number]

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  reset?: boolean

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  disableKnowledge?: boolean

  @IsOptional()
  @IsIn(CONVERSATION_DEBUG_KNOWLEDGE_MODES)
  knowledgeMode?: (typeof CONVERSATION_DEBUG_KNOWLEDGE_MODES)[number]

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  tenantKey?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  guestId?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  name?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(16)
  locale?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(512)
  page?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30000)
  waitTimeoutMs?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationDebugMessageDto)
  messages?: ConversationDebugMessageDto[]
}
