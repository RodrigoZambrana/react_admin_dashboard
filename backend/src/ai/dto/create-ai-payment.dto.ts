import { PaymentStatus, PaymentType } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateAiPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId!: number

  @Type(() => Number)
  @IsNumber()
  amount!: number

  @IsString()
  @MaxLength(8)
  currency!: string

  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus

  @IsOptional()
  @IsString()
  @MaxLength(80)
  method?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string

  @IsOptional()
  @IsString()
  notes?: string
}
