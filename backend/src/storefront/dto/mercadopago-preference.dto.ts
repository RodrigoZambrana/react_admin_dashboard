import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  IsArray,
  Matches,
} from 'class-validator'
import {
  StorefrontAddressDto,
  StorefrontOrderCustomerDto,
  StorefrontOrderItemDto,
} from './order.dto'

class MercadoPagoCheckoutSnapshotDto {
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
  @Type(() => Number)
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
}

export class MercadoPagoPreferenceDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(0.5)
  amount!: number

  @IsString()
  @MaxLength(8)
  currency!: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  cartId?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checkoutToken?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  statementDescriptor?: string

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  payerEmail?: string

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  successUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  failureUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  pendingUrl?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  minInstallments?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxInstallments?: number

  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoCheckoutSnapshotDto)
  checkoutSnapshot?: MercadoPagoCheckoutSnapshotDto
}

export class MercadoPagoResolvePaymentDto {
  @IsString()
  @MaxLength(128)
  externalPaymentId!: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  cartId?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checkoutToken?: string

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  payerEmail?: string
}
