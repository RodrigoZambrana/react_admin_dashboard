import { IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'
import { SalesUnit } from '@prisma/client'

class ProductImagePayload {
  @IsSafeString()
  id!: string

  @IsOptional()
  @IsSafeString()
  name?: string

  @IsSafeString()
  img!: string
}

class ProductSortDto {
  @IsOptional()
  @IsSafeString()
  key?: string

  @IsOptional()
  @IsIn(['asc', 'desc', ''])
  order?: 'asc' | 'desc' | ''
}

export class UpsertProductDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id?: number

  @IsString()
  @IsSafeString()
  name!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  productCode?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  img?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  description?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  specifications?: string

  @IsNumber()
  @Type(() => Number)
  categoryId!: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice!: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice!: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  currency?: string

  @IsOptional()
  @IsEnum(SalesUnit)
  unitOfMeasure?: SalesUnit

  @IsNumber()
  @Type(() => Number)
  stock!: number

  @IsOptional()
  @IsBoolean()
  permanentStock?: boolean

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  costPerItem?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  bulkDiscountPrice?: number

  @IsOptional()
  @IsArray()
  tags?: string[] | { label: string; value: string }[]

  @IsOptional()
  @IsString()
  @IsSafeString()
  brand?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  vendor?: string

  @IsOptional()
  @IsBoolean()
  published?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImagePayload)
  imgList?: ProductImagePayload[]
}

// For updates, allow partial fields and require only id
export class UpdateProductDto {
  @IsNumber()
  @Type(() => Number)
  id!: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  name?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  productCode?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  img?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  description?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  specifications?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  categoryId?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice?: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  currency?: string

  @IsOptional()
  @IsEnum(SalesUnit)
  unitOfMeasure?: SalesUnit

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stock?: number

  @IsOptional()
  @IsBoolean()
  permanentStock?: boolean

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  costPerItem?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  bulkDiscountPrice?: number

  @IsOptional()
  @IsArray()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags?: string[] | { label: string; value: string }[]

  @IsOptional()
  @IsString()
  @IsSafeString()
  brand?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  vendor?: string

  @IsOptional()
  @IsBoolean()
  published?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImagePayload)
  imgList?: ProductImagePayload[]
}

export class TableQueryDto {
  @IsNumber()
  pageIndex!: number

  @IsNumber()
  pageSize!: number

  @IsOptional()
  @IsSafeString()
  query?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductSortDto)
  sort?: ProductSortDto

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @IsOptional()
  filterData?: any
}
