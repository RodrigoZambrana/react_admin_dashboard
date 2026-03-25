import { Transform } from 'class-transformer'
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class DispatchWebchatMessageDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  tenantKey?: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  conversationId!: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  guestId!: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  text!: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
