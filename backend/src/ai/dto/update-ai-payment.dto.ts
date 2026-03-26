import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateAiPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  method?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string

  @IsOptional()
  @IsString()
  notes?: string
}
