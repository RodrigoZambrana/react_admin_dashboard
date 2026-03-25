import { Type } from 'class-transformer'
import { IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator'

class AiOrderItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number

  @IsString()
  @MaxLength(160)
  name!: string

  @Type(() => Number)
  @IsNumber()
  price!: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  comments?: string
}

export class CreateAiOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId!: number

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsString()
  comment?: string

  @IsOptional()
  @IsString()
  shippingAddress1?: string

  @IsOptional()
  @IsString()
  shippingAddress2?: string

  @IsOptional()
  @IsString()
  shippingCity?: string

  @IsOptional()
  @IsString()
  shippingDepartment?: string

  @IsOptional()
  @IsString()
  shippingNeighborhood?: string

  @IsOptional()
  @IsString()
  shippingZip?: string

  @IsOptional()
  @IsString()
  shippingCountry?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryFees?: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiOrderItemDto)
  items!: AiOrderItemDto[]
}

export class GenerateAiQuoteDto extends CreateAiOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validForDays?: number
}
