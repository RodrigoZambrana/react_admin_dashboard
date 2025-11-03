import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'

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

  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return normalized === 'true' || normalized === '1'
    }
    return Boolean(value)
  })
  @IsOptional()
  @IsBoolean()
  clearEstimate?: boolean
}
