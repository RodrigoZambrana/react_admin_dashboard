import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class GetAiMetricsDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  tenantKey?: string

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      return Number(value)
    }
    return value
  })
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number
}
