import { Transform } from 'class-transformer'
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class AgentReplyDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  body!: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
