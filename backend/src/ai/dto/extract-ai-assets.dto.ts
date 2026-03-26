import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

export class ExtractAiAssetDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  assetType?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  fileName?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  contentType?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  content?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  textContent?: string

  @IsOptional()
  @IsBoolean()
  preferAi?: boolean

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

export class ExtractAiAssetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractAiAssetDto)
  assets!: ExtractAiAssetDto[]
}
