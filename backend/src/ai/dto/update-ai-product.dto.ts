import { ProductMode, ProductType, SalesUnit } from '@prisma/client'
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class UpdateAiProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number

  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType

  @IsOptional()
  @IsEnum(ProductMode)
  mode?: ProductMode

  @IsOptional()
  @IsNumber()
  salePrice?: number

  @IsOptional()
  @IsNumber()
  costPrice?: number

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsEnum(SalesUnit)
  unitOfMeasure?: SalesUnit

  @IsOptional()
  @IsInt()
  stock?: number

  @IsOptional()
  @IsBoolean()
  published?: boolean
}
