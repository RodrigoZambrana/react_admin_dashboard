import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const outcomes = ['used', 'edited', 'discarded'] as const
const channels = ['webchat', 'whatsapp', 'email', 'meta', 'admin_chat'] as const
const orderFields = [
  'createdAt',
  'updatedAt',
  'outcome',
  'channel',
  'candidateTitle',
  'actorName',
] as const
const orderDirections = ['asc', 'desc'] as const

export class ListKnowledgeFeedbackDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsOptional()
  @IsIn(scopes)
  scope?: (typeof scopes)[number]

  @IsOptional()
  @IsIn(outcomes)
  outcome?: (typeof outcomes)[number]

  @IsOptional()
  @IsIn(channels)
  channel?: (typeof channels)[number]

  @IsOptional()
  @IsString()
  candidateId?: string

  @IsOptional()
  @IsString()
  conversationId?: string

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
