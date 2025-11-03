import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { EmailProviderType } from '../email-settings.service'

const PROVIDER_TYPES = ['SMTP', 'SENDGRID', 'DEV'] as const

class SmtpConfigDto {
  @IsString()
  @IsNotEmpty()
  host!: string

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number

  @IsBoolean()
  secure!: boolean

  @IsBoolean()
  allowInvalidCerts!: boolean

  @IsOptional()
  @IsString()
  user?: string | null

  @IsOptional()
  @IsString()
  password?: string | null
}

export class UpdateEmailConfigDto {
  @IsString()
  @IsIn(PROVIDER_TYPES)
  provider!: EmailProviderType

  @IsEmail()
  fromAddress!: string

  @IsString()
  @IsNotEmpty()
  fromName!: string

  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpConfigDto)
  smtp?: SmtpConfigDto | null
}

export class EmailConfigTestDto {
  @IsEmail()
  to!: string
}
