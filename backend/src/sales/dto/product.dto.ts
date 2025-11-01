import { IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'
import { ProductAttributeType, ProductMode, SalesUnit } from '@prisma/client'

class ProductImagePayload {
  @IsSafeString()
  id!: string

  @IsOptional()
  @IsSafeString()
  name?: string

  @IsSafeString()
  img!: string
}

class ProductAttributeValuePayload {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id?: number

  @IsString()
  @IsSafeString()
  key!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  label?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  value?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  colorHex?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  imageUrl?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  imageAlt?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number
}

class ProductAttributePayload {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id?: number

  @IsEnum(ProductAttributeType)
  type!: ProductAttributeType

  @IsOptional()
  @IsString()
  @IsSafeString()
  name?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValuePayload)
  values!: ProductAttributeValuePayload[]
}

class ProductVariantAttributePayload {
  @IsEnum(ProductAttributeType)
  attribute!: ProductAttributeType

  @IsString()
  @IsSafeString()
  valueKey!: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  optionValueId?: number
}

class ProductVariantPayload {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id?: number

  @IsString()
  @IsSafeString()
  key!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributePayload)
  attributes!: ProductVariantAttributePayload[]

  @IsOptional()
  @IsString()
  @IsSafeString()
  sku?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  barcode?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  label?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  salePrice?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  costPrice?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stock?: number

  @IsOptional()
  @IsBoolean()
  permanentStock?: boolean

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  inheritSalePrice?: boolean

  @IsOptional()
  @IsBoolean()
  inheritCostPrice?: boolean

  @IsOptional()
  @IsBoolean()
  inheritStock?: boolean

  @IsOptional()
  @IsBoolean()
  inheritSku?: boolean

  @IsOptional()
  @IsBoolean()
  inheritImages?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImagePayload)
  images?: ProductImagePayload[]
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
  @IsEnum(ProductMode)
  mode?: ProductMode

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributePayload)
  attributes?: ProductAttributePayload[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantPayload)
  variants?: ProductVariantPayload[]
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
  @IsEnum(ProductMode)
  mode?: ProductMode

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributePayload)
  attributes?: ProductAttributePayload[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantPayload)
  variants?: ProductVariantPayload[]
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
