import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

const statuses = ['running', 'completed', 'failed'] as const
const sourceTypes = [
  'docs',
  'backend_dataset',
  'admin_curated',
  'conversation_derived',
] as const
const orderFields = [
  'startedAt',
  'finishedAt',
  'createdAt',
  'status',
  'processedCount',
  'createdCandidates',
  'errorCount',
] as const
const orderDirections = ['asc', 'desc'] as const

export class ListKnowledgeIngestionRunsDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number]

  @IsOptional()
  @IsIn(sourceTypes)
  sourceType?: (typeof sourceTypes)[number]

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  })
  @IsInt()
  @Min(1)
  createdByUserId?: number

  @IsOptional()
  @IsString()
  from?: string

  @IsOptional()
  @IsString()
  to?: string

  @IsOptional()
  @IsIn(orderFields)
  orderBy?: (typeof orderFields)[number]

  @IsOptional()
  @IsIn(orderDirections)
  orderDir?: (typeof orderDirections)[number]

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  })
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number
}
