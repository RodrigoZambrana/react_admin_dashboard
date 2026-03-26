import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateAiDocumentStatusDto {
  @IsString()
  status!: string

  @IsOptional()
  @IsBoolean()
  force?: boolean
}
