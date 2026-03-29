import { Type } from 'class-transformer'
import { IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, ValidateNested, Min } from 'class-validator'

export class PreviewAiProductQuoteItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  widthMm?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  heightMm?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lengthMm?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number
}

export class PreviewAiProductQuoteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  widthMm?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  heightMm?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lengthMm?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewAiProductQuoteItemDto)
  items?: PreviewAiProductQuoteItemDto[]

  @IsOptional()
  @IsString()
  @MaxLength(5)
  targetCurrency?: string
}
