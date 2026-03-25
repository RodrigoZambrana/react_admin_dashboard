import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'

const conversationScopes = ['customer_public', 'admin_internal'] as const
const conversationChannels = ['webchat', 'email', 'whatsapp', 'facebook', 'instagram', 'admin_chat'] as const
const conversationControlModes = ['ai', 'human', 'hybrid'] as const
const conversationStatuses = ['open', 'closed', 'waiting_customer', 'waiting_internal'] as const

export class ListConversationsDto {
  @IsOptional()
  @IsIn(conversationScopes)
  scope?: (typeof conversationScopes)[number]

  @IsOptional()
  @IsIn(conversationChannels)
  channel?: (typeof conversationChannels)[number]

  @IsOptional()
  @IsIn(conversationControlModes)
  controlMode?: (typeof conversationControlModes)[number]

  @IsOptional()
  @IsIn(conversationStatuses)
  status?: (typeof conversationStatuses)[number]

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  search?: string

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  assignedToMe?: boolean

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  pageSize?: number = 20
}
