import { IsIn, IsOptional, IsString } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const sourceTypes = [
  'docs',
  'backend_dataset',
  'admin_curated',
  'conversation_derived',
] as const
const statuses = ['draft', 'active', 'archived'] as const

export class ListKnowledgeDocumentsDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsOptional()
  @IsIn(scopes)
  scope?: (typeof scopes)[number]

  @IsOptional()
  @IsIn(sourceTypes)
  sourceType?: (typeof sourceTypes)[number]

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number]

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['true', 'false'])
  sourceFileOnly?: 'true' | 'false'
}
