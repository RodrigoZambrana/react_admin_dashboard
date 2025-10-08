import { IsEmail, IsOptional, IsString } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  role?: 'superadmin' | 'admin' | 'user'

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  countryCode?: string

  @IsOptional()
  @IsString()
  city?: string
}
