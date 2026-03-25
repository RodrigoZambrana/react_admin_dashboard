import { IsIn, IsOptional, IsString } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const statuses = ['pending', 'approved', 'rejected'] as const

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
}
