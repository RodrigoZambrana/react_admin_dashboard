import { IsOptional, IsString } from 'class-validator'

export class PreviewEmailTemplateDto {
  @IsOptional()
  @IsString()
  locale?: string

  @IsOptional()
  @IsString()
  scenarioKey?: string
}
