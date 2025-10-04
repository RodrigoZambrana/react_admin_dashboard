import { IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, ValidateNested, IsNotEmpty } from 'class-validator'
import { Type } from 'class-transformer'

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsNumber()
  price!: number

  @IsNumber()
  qty!: number

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  description?: string
}

export class AddressDto {
  @IsOptional()
  @IsString()
  addressLine1?: string

  @IsOptional()
  @IsString()
  addressLine2?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  state?: string

  // Atomic fields mapping to address lines
  @IsOptional()
  @IsString()
  street?: string

  @IsOptional()
  @IsString()
  number?: string

  @IsOptional()
  @IsString()
  corner?: string

  @IsOptional()
  @IsString()
  apartment?: string
}

export class ShippingDto {
  @IsOptional()
  @IsString()
  shippingVendor?: string

  @IsOptional()
  @IsNumber()
  deliveryFees?: number

  @IsOptional()
  @IsNumber()
  estimatedMin?: number

  @IsOptional()
  @IsNumber()
  estimatedMax?: number
}

export class CreateOrderDto {
  @IsString()
  customerId!: string

  @IsOptional()
  @IsDateString()
  date?: string

  @IsString()
  paymentMehod!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[]

  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress!: AddressDto

  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress!: AddressDto

  @IsBoolean()
  billingSameAsShipping!: boolean

  @ValidateNested()
  @Type(() => ShippingDto)
  shipping!: ShippingDto

  @IsOptional()
  @IsString()
  comment?: string
}
