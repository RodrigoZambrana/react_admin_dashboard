import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const statuses = ['pending', 'approved', 'rejected'] as const
const sourceTypes = [
  'docs',
  'backend_dataset',
  'admin_curated',
  'conversation_derived',
] as const
const channels = ['webchat', 'whatsapp', 'email', 'meta', 'admin_chat'] as const
const originCategories = [
  'conversation_suggested',
  'conversation_approved',
  'manual_candidate',
  'dataset_candidate',
] as const
const orderFields = [
  'updatedAt',
  'createdAt',
  'status',
  'confidence',
  'detectedIntent',
  'feedbackApplied',
] as const
const orderDirections = ['asc', 'desc'] as const

export class ListKnowledgeCandidatesDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsOptional()
  @IsIn(scopes)
  scope?: (typeof scopes)[number]

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number]

  @IsOptional()
  @IsIn(sourceTypes)
  sourceType?: (typeof sourceTypes)[number]

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsString()
  detectedIntent?: string

  @IsOptional()
  @IsIn(channels)
  channel?: (typeof channels)[number]

  @IsOptional()
  @IsIn(originCategories)
  originCategory?: (typeof originCategories)[number]

  @IsOptional()
  @IsIn(['true', 'false'])
  hasFeedback?: 'true' | 'false'

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
  @Max(200)
  pageSize?: number
}
