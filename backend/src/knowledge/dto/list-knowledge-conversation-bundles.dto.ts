import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const statuses = ['pending', 'approved', 'rejected'] as const
const channels = ['webchat', 'whatsapp', 'email', 'meta', 'admin_chat'] as const
const orderFields = [
  'updatedAt',
  'createdAt',
  'approvedCount',
  'pendingCount',
  'eventCount',
  'candidateCount',
] as const
const orderDirections = ['asc', 'desc'] as const

export class ListKnowledgeConversationBundlesDto {
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
  @IsIn(channels)
  channel?: (typeof channels)[number]

  @IsOptional()
  @IsString()
  search?: string

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
