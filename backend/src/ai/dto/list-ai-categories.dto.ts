import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class ListAiCategoriesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}
