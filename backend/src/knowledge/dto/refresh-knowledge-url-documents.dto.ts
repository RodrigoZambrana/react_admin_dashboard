import { IsIn, IsOptional, IsString } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const

export class RefreshKnowledgeUrlDocumentsDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsOptional()
  @IsIn(scopes)
  scope?: (typeof scopes)[number]
}
