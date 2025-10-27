import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

const sanitizePhoneString = (value: string): string => value.replace(/\s+/g, '')

const coerceOptionalInt = (input: unknown): number | undefined => {
  if (input === undefined) {
    return undefined
  }
  if (input === null || input === '') {
    return undefined
  }
  const raw =
    typeof input === 'number'
      ? input
      : typeof input === 'string'
        ? Number(input.trim())
        : Number(String(input))
  if (!Number.isFinite(raw)) {
    return undefined
  }
  const int = Math.trunc(raw)
  return Number.isFinite(int) ? int : undefined
}

const coerceNullableInt = (input: unknown): number | null | undefined => {
  if (input === undefined) {
    return undefined
  }
  if (input === null) {
    return null
  }
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed.length) {
      return null
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      return undefined
    }
    return Math.trunc(parsed)
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return undefined
    }
    return Math.trunc(input)
  }
  const parsed = Number(String(input))
  if (!Number.isFinite(parsed)) {
    return undefined
  }
  return Math.trunc(parsed)
}

class CustomerStatusPayloadDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => coerceOptionalInt(value))
  id?: number

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  color?: string
}

class CustomerAddressDto {
  @IsOptional()
  @IsString()
  street?: string

  @IsOptional()
  @IsNumberString()
  number?: string

  @IsOptional()
  @IsString()
  corner?: string

  @IsOptional()
  @IsString()
  apartment?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  comments?: string

  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean
}

class CustomerPersonalInfoDto {
  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return null
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return value
  })
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsEmail()
  email?: string | null

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  facebook?: string

  @IsOptional()
  @IsString()
  twitter?: string

  @IsOptional()
  @IsString()
  pinterest?: string

  @IsOptional()
  @IsString()
  linkedIn?: string

  @Transform(({ value }) => (typeof value === 'string' ? sanitizePhoneString(value) : value))
  @IsOptional()
  @IsString()
  phoneNumber?: string

  @Transform(({ value }) =>
    Array.isArray(value)
      ? (value as unknown[]).map((item) => (typeof item === 'string' ? sanitizePhoneString(item) : item))
      : typeof value === 'string'
        ? sanitizePhoneString(value)
        : value,
  )
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[]

  @IsOptional()
  @IsString()
  birthday?: string
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => coerceOptionalInt(value))
  id?: number

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return null
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return value
  })
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsEmail()
  email?: string | null

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  facebook?: string

  @IsOptional()
  @IsString()
  twitter?: string

  @IsOptional()
  @IsString()
  pinterest?: string

  @IsOptional()
  @IsString()
  linkedIn?: string

  @Transform(({ value }) => (typeof value === 'string' ? sanitizePhoneString(value) : value))
  @IsOptional()
  @IsString()
  phoneNumber?: string

  @Transform(({ value }) =>
    Array.isArray(value)
      ? (value as unknown[]).map((item) => (typeof item === 'string' ? sanitizePhoneString(item) : item))
      : typeof value === 'string'
        ? sanitizePhoneString(value)
        : value,
  )
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[]

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerPersonalInfoDto)
  personalInfo?: CustomerPersonalInfoDto

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerStatusPayloadDto)
  status?: CustomerStatusPayloadDto

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto

  @IsOptional()
  @Transform(({ value }) => coerceNullableInt(value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  statusId?: number | null

  @IsOptional()
  @IsString()
  statusName?: string

  @IsOptional()
  @IsString()
  birthday?: string
}
