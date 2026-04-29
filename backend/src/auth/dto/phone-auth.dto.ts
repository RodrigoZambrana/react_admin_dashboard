import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterPhoneDto {
  @IsString()
  phone!: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsString()
  locale?: string
}

export class SendOtpDto {
  @IsString()
  phone!: string

  @IsOptional()
  @IsIn(['verification', 'recovery'])
  type?: 'verification' | 'recovery'
}

export class VerifyOtpDto {
  @IsString()
  phone!: string

  @IsString()
  code!: string
}

export class RecoverAccountDto {
  @IsIn(['sms', 'email'])
  method!: 'sms' | 'email'

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsEmail()
  email?: string
}

export class ResetPasswordDto {
  @IsIn(['sms', 'email'])
  method!: 'sms' | 'email'

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsString()
  token?: string

  @IsString()
  @MinLength(8)
  password!: string
}

