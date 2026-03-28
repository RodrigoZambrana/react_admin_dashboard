import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const statuses = ['draft', 'active', 'archived'] as const

export class UpdateKnowledgeDocumentDto {
  @IsOptional()
  @IsIn(scopes)
  scope?: (typeof scopes)[number]

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number]

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
