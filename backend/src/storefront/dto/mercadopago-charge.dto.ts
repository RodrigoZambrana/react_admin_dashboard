import { Type } from 'class-transformer'
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

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

  @ValidateNested()
  @Type(() => MercadoPagoIdentificationDto)
  identification!: MercadoPagoIdentificationDto
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
