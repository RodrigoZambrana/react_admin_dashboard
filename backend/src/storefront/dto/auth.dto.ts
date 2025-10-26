import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

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
}

export class StorefrontLoginDto {
  @IsEmail()
  email!: string

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
  @IsString()
  phone?: string
}
