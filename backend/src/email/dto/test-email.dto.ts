import { EmailCategory, EmailTemplateVariant } from '@prisma/client'
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator'

export class TestEmailDto {
  @IsEnum(EmailCategory)
  category!: EmailCategory

  @IsEmail()
  to!: string

  @IsOptional()
  @IsEnum(EmailTemplateVariant)
  variant?: EmailTemplateVariant

  @IsOptional()
  @IsString()
  locale?: string
}
