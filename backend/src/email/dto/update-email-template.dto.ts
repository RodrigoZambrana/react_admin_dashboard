import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  subject?: string

  @IsOptional()
  @IsString()
  body?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
