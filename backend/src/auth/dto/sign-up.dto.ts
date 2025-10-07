import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class SignUpDto {
  @IsString()
  userName!: string

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string
}
