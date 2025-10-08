import { IsInt, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'

export class DashboardFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startDate?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endDate?: number
}
