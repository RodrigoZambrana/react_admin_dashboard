import { Transform } from 'class-transformer'
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

export class StorefrontRegisterDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? (value.trim().length > 0 ? value.trim() : undefined) : value))
  @IsSafeString()
  @IsEmail()
  email?: string

  @IsString()
  @Matches(/\S/, { message: 'text.validation.invalidCharacters' })
  @MinLength(8)
  password!: string

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsSafeString()
  @MinLength(1)
  firstName!: string

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsSafeString()
  @MinLength(1)
  lastName!: string

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsSafeString()
  @MinLength(6)
  phone?: string

  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  locale?: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}

export class StorefrontLoginDto {
  @IsString()
  identifier!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}

export class StorefrontRefreshDto {
  @IsString()
  refreshToken!: string
}

export class StorefrontUpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsEmail()
  email?: string | null

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null

  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  locale?: string
}

export class StorefrontEmailVerificationDto {
  @IsString()
  @MinLength(10)
  token!: string
}
