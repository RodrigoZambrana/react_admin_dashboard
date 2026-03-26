import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class ParseAiAberturasDto {
  @IsString()
  @MinLength(4)
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
