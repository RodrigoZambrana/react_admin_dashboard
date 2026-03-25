import { Transform } from 'class-transformer'
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

export class IndexKnowledgeDocumentsDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  tenantKey?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  scope?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[]
}
