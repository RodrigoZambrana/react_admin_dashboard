import { IsOptional, IsString, MaxLength } from 'class-validator'

export class PrepareAiAberturasInsertDto {
  @IsString()
  @MaxLength(12000)
  text!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceDate?: string
}
