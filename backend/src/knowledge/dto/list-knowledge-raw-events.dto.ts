import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

const statuses = ['new', 'processed', 'discarded'] as const
const channels = ['webchat', 'whatsapp', 'email', 'meta', 'admin_chat'] as const
const authorTypes = ['customer', 'operator', 'agent', 'system'] as const
const orderFields = [
  'updatedAt',
  'createdAt',
  'status',
  'channel',
  'confidence',
  'detectedIntent',
] as const
const orderDirections = ['asc', 'desc'] as const

export class ListKnowledgeRawEventsDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number]

  @IsOptional()
  @IsString()
  conversationId?: string

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(channels)
  channel?: (typeof channels)[number]

  @IsOptional()
  @IsIn(authorTypes)
  sourceAuthorType?: (typeof authorTypes)[number]

  @IsOptional()
  @IsString()
  detectedIntent?: string

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
