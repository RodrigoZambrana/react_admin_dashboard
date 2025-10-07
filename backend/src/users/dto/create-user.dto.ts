import { IsEmail, IsOptional, IsString } from 'class-validator'

export class CreateUserDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  role?: 'superadmin' | 'admin' | 'user'
}
