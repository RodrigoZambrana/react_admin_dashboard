import { Type } from 'class-transformer'
import { IsEmail, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator'

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
}
