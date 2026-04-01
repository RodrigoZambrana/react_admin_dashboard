import { Transform } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

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

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(['all', 'pending', 'failed'])
  selection?: 'all' | 'pending' | 'failed'

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      return value === 'true'
    }
    return value
  })
  @IsBoolean()
  background?: boolean

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      return Number(value)
    }
    return value
  })
  @IsInt()
  @Min(1)
  @Max(200)
  batchSize?: number
}
