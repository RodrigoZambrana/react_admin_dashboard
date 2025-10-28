import { IsArray, IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator'

export class UpdateEmailSettingsDto {
  @IsOptional()
  @IsEmail()
  fromAddress?: string

  @IsOptional()
  @IsString()
  fromName?: string | null

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  adminRecipients?: string[]

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[]

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[]

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
