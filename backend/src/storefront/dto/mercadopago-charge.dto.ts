import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsArray,
  Matches,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import {
  StorefrontAddressDto,
  StorefrontOrderCustomerDto,
  StorefrontOrderItemDto,
} from './order.dto'

class MercadoPagoIdentificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  type!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  number!: string
}

class MercadoPagoPayerDto {
  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoIdentificationDto)
  identification?: MercadoPagoIdentificationDto
}

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

export class MercadoPagoChargeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  cartId?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checkoutToken?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  currency!: string

  @IsString()
  @IsNotEmpty()
  token!: string

  @IsNumber()
  @IsPositive()
  @Min(0.5)
  transactionAmount!: number

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @IsInt()
  @IsPositive()
  installments!: number

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  paymentMethodId!: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  issuerId?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  statementDescriptor?: string

  @ValidateNested()
  @Type(() => MercadoPagoPayerDto)
  payer!: MercadoPagoPayerDto

  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoCheckoutSnapshotDto)
  checkoutSnapshot?: MercadoPagoCheckoutSnapshotDto
}

export class MercadoPagoWebhookDataDto {
  @IsString()
  @IsNotEmpty()
  id!: string
}

export class MercadoPagoWebhookDto {
  @IsString()
  @IsNotEmpty()
  type!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string

  @ValidateNested()
  @Type(() => MercadoPagoWebhookDataDto)
  data!: MercadoPagoWebhookDataDto

  @IsOptional()
  @IsString()
  id?: string
}
