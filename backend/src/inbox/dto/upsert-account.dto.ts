import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

const normalizeString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export class UpsertInboxAccountDto {
  @Transform(normalizeString, { toClassOnly: true })
  @IsEmail()
  address!: string

  @IsOptional()
  @Transform(normalizeString, { toClassOnly: true })
  @IsString()
  @MaxLength(120)
  displayName?: string | null

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true', { toClassOnly: true })
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null
}

export class UpdateInboxAccountDto {
  @IsOptional()
  @Transform(normalizeString, { toClassOnly: true })
  @IsEmail()
  address?: string | null

  @IsOptional()
  @Transform(normalizeString, { toClassOnly: true })
  @IsString()
  @MaxLength(120)
  displayName?: string | null

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true', { toClassOnly: true })
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null
}
