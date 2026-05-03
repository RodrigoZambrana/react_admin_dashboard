import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

const toInt = (value?: string | number | null) => {
  if (value === undefined || value === null) return undefined
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

const toNumber = (value?: string | number | null) => {
  if (value === undefined || value === null) return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

export class StorefrontProductQueryDto {
  @IsOptional()
  @Transform(({ value }) => toInt(value) ?? 1)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Transform(({ value }) => toInt(value) ?? 12)
  @IsInt()
  @Min(1)
  pageSize?: number = 12

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsString()
  sort?: string

  @IsOptional()
  @IsString()
  tag?: string

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  priceMin?: number

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  priceMax?: number

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  rating?: number
}
