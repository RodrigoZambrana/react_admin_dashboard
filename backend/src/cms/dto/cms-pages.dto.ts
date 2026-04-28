import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import {
  CmsEntryStatus,
  CmsPageScope,
  CmsMediaType,
  CmsPageBlockType,
  CmsPageSectionType,
} from '@prisma/client'

export class CmsListPagesQueryDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsString()
  locale?: string

  @IsOptional()
  @IsEnum(CmsEntryStatus)
  status?: CmsEntryStatus

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  visible?: boolean

  @IsOptional()
  @IsEnum(CmsPageScope)
  scope?: CmsPageScope
}

export class CmsPageBlockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number

  @IsEnum(CmsPageBlockType)
  type!: CmsPageBlockType

  @IsOptional()
  @IsString()
  @MaxLength(120)
  key?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number

  @IsOptional()
  @IsBoolean()
  visible?: boolean

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown> | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mediaId?: number | null
}

export class CmsPageSectionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number

  @IsEnum(CmsPageSectionType)
  type!: CmsPageSectionType

  @IsOptional()
  @IsString()
  @MaxLength(120)
  key?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number

  @IsOptional()
  @IsBoolean()
  visible?: boolean

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown> | null

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmsPageBlockDto)
  blocks?: CmsPageBlockDto[]
}

export class CmsPageDto {
  @IsString()
  path!: string

  @IsString()
  @MaxLength(180)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null

  @IsOptional()
  @IsEnum(CmsPageScope)
  scope?: CmsPageScope

  @IsOptional()
  @IsString()
  locale?: string

  @IsOptional()
  @IsEnum(CmsEntryStatus)
  status?: CmsEntryStatus

  @IsOptional()
  @IsBoolean()
  visible?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(180)
  seoTitle?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoImageUrl?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(120)
  layoutKey?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  legacySource?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmsPageSectionDto)
  sections?: CmsPageSectionDto[]
}

export class CmsListMediaQueryDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(CmsMediaType)
  type?: CmsMediaType

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean
}

export class CmsMediaDto {
  @IsOptional()
  @IsString()
  url?: string

  @IsOptional()
  @IsEnum(CmsMediaType)
  type?: CmsMediaType

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(160)
  mimeType?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  fileName?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sizeBytes?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  source?: string | null

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
