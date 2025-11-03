import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
  IsObject,
  Matches,
} from 'class-validator'

class StorefrontOrderCustomerDto {
  @IsEmail()
  email!: string

  @IsString()
  firstName!: string

  @IsString()
  lastName!: string

  @IsOptional()
  @IsString()
  phone?: string
}

class StorefrontAddressDto {
  @IsString()
  line1!: string

  @IsOptional()
  @IsString()
  line2?: string

  @IsString()
  city!: string

  @IsOptional()
  @IsString()
  state?: string

  @IsString()
  zip!: string

  @IsString()
  country!: string
}

class StorefrontOrderItemDto {
  @IsInt()
  @IsPositive()
  productId!: number

  @IsInt()
  @IsPositive()
  quantity!: number

  @IsOptional()
  @IsInt()
  @IsPositive()
  variantId?: number

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>
}

export class StorefrontCreateOrderDto {
  @ValidateNested()
  @Type(() => StorefrontOrderCustomerDto)
  customer!: StorefrontOrderCustomerDto

  @ValidateNested()
  @Type(() => StorefrontAddressDto)
  shippingAddress!: StorefrontAddressDto

  @ValidateNested()
  @Type(() => StorefrontAddressDto)
  @IsOptional()
  billingAddress?: StorefrontAddressDto

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StorefrontOrderItemDto)
  items!: StorefrontOrderItemDto[]

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  paymentIntentId?: string

  @IsOptional()
  @IsString()
  checkoutToken?: string

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'Currency must be a 3-letter ISO code' })
  currency?: string
}
