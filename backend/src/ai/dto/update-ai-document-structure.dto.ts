import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { AiOrderItemDto } from './create-ai-order.dto'

export class UpdateAiDocumentStructureDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsString()
  comment?: string

  @IsOptional()
  @IsString()
  shippingAddress1?: string

  @IsOptional()
  @IsString()
  shippingAddress2?: string

  @IsOptional()
  @IsString()
  shippingCity?: string

  @IsOptional()
  @IsString()
  shippingDepartment?: string

  @IsOptional()
  @IsString()
  shippingNeighborhood?: string

  @IsOptional()
  @IsString()
  shippingZip?: string

  @IsOptional()
  @IsString()
  shippingCountry?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryFees?: number

  @IsOptional()
  @IsString()
  shippingVendor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMin?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMax?: number

  @IsOptional()
  @IsDateString()
  validUntilDate?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validForDays?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiOrderItemDto)
  items?: AiOrderItemDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiOrderItemDto)
  appendItems?: AiOrderItemDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removeItemNames?: string[]
}
