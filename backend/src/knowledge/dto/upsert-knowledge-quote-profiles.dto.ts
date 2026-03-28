import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const

export class UpsertKnowledgeQuoteProfilesDto {
  @IsOptional()
  @IsString()
  documentId?: string

  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsIn(scopes)
  scope!: (typeof scopes)[number]

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsArray()
  @IsObject({ each: true })
  profiles!: Record<string, unknown>[]
}
