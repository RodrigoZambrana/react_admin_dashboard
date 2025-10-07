import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsObject } from 'class-validator'
import { Type } from 'class-transformer'

export class UpsertProductDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id?: number

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  productCode?: string

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNumber()
  @Type(() => Number)
  categoryId!: number

  @IsNumber()
  @Type(() => Number)
  price!: number

  @IsOptional()
  @IsString()
  currency?: string

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
  brand?: string

  @IsOptional()
  @IsString()
  vendor?: string

  @IsOptional()
  @IsBoolean()
  published?: boolean

  @IsOptional()
  @IsArray()
  imgList?: { id: string; name?: string; img: string }[]
}

// For updates, allow partial fields and require only id
export class UpdateProductDto {
  @IsNumber()
  @Type(() => Number)
  id!: number

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  productCode?: string

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  categoryId?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number

  @IsOptional()
  @IsString()
  currency?: string

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
  brand?: string

  @IsOptional()
  @IsString()
  vendor?: string

  @IsOptional()
  @IsBoolean()
  published?: boolean

  @IsOptional()
  @IsArray()
  imgList?: { id: string; name?: string; img: string }[]
}

export class TableQueryDto {
  @IsNumber()
  pageIndex!: number

  @IsNumber()
  pageSize!: number

  @IsOptional()
  @IsString()
  query?: string

  @IsOptional()
  @IsObject()
  sort?: { key?: string; order?: 'asc' | 'desc' | '' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @IsOptional()
  filterData?: any
}
