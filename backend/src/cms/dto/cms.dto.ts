import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator'
import { CmsEntryAssetType, CmsEntryStatus } from '@prisma/client'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

export class CmsSectionDto {
  @IsString()
  @Matches(/^[A-Z0-9_:-]+$/)
  key!: string

  @IsString()
  @IsSafeString()
  name!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number
}

export class CmsEntryAssetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  title?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  caption?: string

  @IsEnum(CmsEntryAssetType)
  mediaType!: CmsEntryAssetType

  @IsString()
  @IsSafeString()
  mediaUrl!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  posterUrl?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  externalUrl?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationSec?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class CmsEntryDto {
  @Type(() => Number)
  @IsInt()
  sectionId!: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  slug?: string

  @IsString()
  @IsSafeString()
  title!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  subtitle?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  description?: string

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown> | null

  @IsOptional()
  @IsString()
  @IsSafeString()
  locale?: string

  @IsOptional()
  @IsEnum(CmsEntryStatus)
  status?: CmsEntryStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Date)
  publishedAt?: Date | null

  @IsOptional()
  @Type(() => Date)
  startsAt?: Date | null

  @IsOptional()
  @Type(() => Date)
  endsAt?: Date | null

  @IsOptional()
  @IsString()
  @IsSafeString()
  thumbnailUrl?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  ctaLabel?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  ctaUrl?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number | null

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmsEntryAssetDto)
  assets?: CmsEntryAssetDto[]
}

export class CmsListEntriesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  sectionKey?: string
}
