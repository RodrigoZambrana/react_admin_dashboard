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

  @IsOptional()
  @IsString()
  @MinLength(6)
  phone?: string
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
  @IsString()
  phone?: string
}
