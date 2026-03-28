import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const sourceTypes = [
  'docs',
  'web_url',
  'backend_dataset',
  'admin_curated',
  'conversation_derived',
] as const
const statuses = ['draft', 'active', 'archived'] as const
const originCategories = [
  'uploaded_document',
  'website_url',
  'manual_entry',
  'conversation_approved',
  'dataset_snapshot',
  'trusted_doc',
] as const
const contentTypes = [
  'document_file',
  'web_page',
  'plain_text',
  'conversation_response',
  'dataset_snapshot',
  'multimodal_extract',
] as const
const orderFields = [
  'updatedAt',
  'createdAt',
  'title',
  'sourceType',
  'status',
  'approvedAt',
] as const
const orderDirections = ['asc', 'desc'] as const

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

  @IsOptional()
  @IsIn(originCategories)
  originCategory?: (typeof originCategories)[number]

  @IsOptional()
  @IsIn(contentTypes)
  contentType?: (typeof contentTypes)[number]

  @IsOptional()
  @IsIn(['true', 'false'])
  hasEmbedding?: 'true' | 'false'

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
