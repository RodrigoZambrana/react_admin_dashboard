import { Type } from 'class-transformer'
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class UpdateOrderDeliveryDto {
  @IsOptional()
  @IsString()
  shippingVendor?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryFees?: number

  @IsOptional()
  @IsDateString()
  estimatedDate?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMinDays?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMaxDays?: number
}
