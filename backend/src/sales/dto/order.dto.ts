import { IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, ValidateNested, IsNotEmpty } from 'class-validator'
import { Type } from 'class-transformer'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  @IsSafeString()
  productId!: string

  @IsString()
  @IsNotEmpty()
  @IsSafeString()
  name!: string

  @IsNumber()
  price!: number

  @IsNumber()
  qty!: number

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
  currency?: string

  @IsOptional()
  @IsNumber()
  unitPrice?: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  unitCurrency?: string
}

export class AddressDto {
  @IsOptional()
  @IsString()
  @IsSafeString()
  addressLine1?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  addressLine2?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  city?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  state?: string

  // Atomic fields mapping to address lines
  @IsOptional()
  @IsString()
  @IsSafeString()
  street?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  number?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  corner?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  apartment?: string
}

export class ShippingDto {
  @IsOptional()
  @IsString()
  @IsSafeString()
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
  @IsSafeString()
  customerId!: string

  @IsOptional()
  @IsDateString()
  date?: string

  @IsString()
  @IsSafeString()
  paymentMehod!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  orderCurrency?: string

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
  @IsSafeString()
  comment?: string
}
