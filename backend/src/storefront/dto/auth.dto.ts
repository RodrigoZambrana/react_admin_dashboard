import { IsDateString, IsEmail, IsOptional, IsString, MinLength, IsIn } from 'class-validator'

export class StorefrontRegisterDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsString()
  firstName!: string

  @IsString()
  lastName!: string

  @IsOptional()
  @IsString()
  @MinLength(6)
  phone?: string

  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  locale?: string
}

export class StorefrontLoginDto {
  @IsString()
  identifier!: string

  @IsString()
  @MinLength(8)
  password!: string
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
