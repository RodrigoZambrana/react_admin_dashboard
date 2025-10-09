import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class SignInDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}
