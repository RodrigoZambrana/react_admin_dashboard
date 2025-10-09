import { IsOptional, IsString, MinLength } from 'class-validator'

export class SignInDto {
  @IsString()
  userName!: string

  @IsString()
  @MinLength(6)
  password!: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}

