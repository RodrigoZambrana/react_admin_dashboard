import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
  IsObject,
  Matches,
  IsIn,
} from 'class-validator'

export class StorefrontOrderCustomerDto {
  @IsOptional()
  @IsEmail()
  email?: string

  @IsString()
  firstName!: string

  @IsString()
  lastName!: string

  @IsString()
  phone!: string

  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  locale?: string
}

export class StorefrontAddressDto {
  @IsString()
  line1!: string

  @IsOptional()
  @IsString()
  line2?: string

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

  @IsOptional()
  @IsString()
  comments?: string

  @IsString()
  city!: string

  @IsOptional()
  @IsString()
  state?: string

  @IsString()
  department!: string

  @IsString()
  zip!: string

  @IsString()
  country!: string

  @IsOptional()
  @IsString()
  neighborhood?: string
}

export class StorefrontOrderItemDto {
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

  @IsOptional()
  @IsNumber()
  @Min(0.0000001)
  @Type(() => Number)
  width?: number

  @IsOptional()
  @IsNumber()
  @Min(0.0000001)
  @Type(() => Number)
  height?: number

  @IsOptional()
  @Type(() => Boolean)
  derived?: boolean

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  reference?: number
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
  @IsInt()
  @IsPositive()
  shippingOptionId?: number

  @IsOptional()
  @IsString()
  @IsIn(['home_delivery'])
  fulfillmentMode?: 'home_delivery'

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'Currency must be a 3-letter ISO code' })
  currency?: string

  @IsOptional()
  @IsObject()
  analytics?: {
    sessionId?: string
    userId?: string
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    referrer?: string | null
  }
}
