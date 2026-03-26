import { IsInt, IsOptional } from 'class-validator'

export class AdjustAiProductStockDto {
  @IsOptional()
  @IsInt()
  delta?: number

  @IsOptional()
  @IsInt()
  stock?: number
}
