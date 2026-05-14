import { IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator'

export class StorefrontPasswordForgotDto {
  @IsIn(['email', 'phone'])
  channel!: 'email' | 'phone'

  @ValidateIf((value: StorefrontPasswordForgotDto) => value.channel === 'email')
  @IsString()
  @MinLength(5)
  email?: string

  @ValidateIf((value: StorefrontPasswordForgotDto) => value.channel === 'phone')
  @IsString()
  @MinLength(6)
  phone?: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}

export class StorefrontPasswordVerifyOtpDto {
  @IsString()
  @MinLength(6)
  phone!: string

  @IsString()
  @MinLength(4)
  otp!: string
}

export class StorefrontPasswordResetDto {
  @IsIn(['email', 'phone'])
  channel!: 'email' | 'phone'

  @IsString()
  @MinLength(8)
  newPassword!: string

  @ValidateIf((value: StorefrontPasswordResetDto) => value.channel === 'email')
  @IsString()
  @MinLength(10)
  token?: string

  @ValidateIf((value: StorefrontPasswordResetDto) => value.channel === 'phone')
  @IsString()
  @MinLength(10)
  resetSessionToken?: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}

export class StorefrontPasswordChangeDto {
  @IsString()
  @MinLength(8)
  newPassword!: string

  @IsString()
  @MinLength(10)
  reauthToken!: string

  @IsOptional()
  keepSession?: boolean
}

export class StorefrontReauthPasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string
}
