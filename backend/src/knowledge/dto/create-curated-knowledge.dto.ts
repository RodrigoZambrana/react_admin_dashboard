import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const

export class CreateCuratedKnowledgeDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsIn(scopes)
  scope!: (typeof scopes)[number]

  @IsString()
  @MaxLength(160)
  title!: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsString()
  content!: string

  @IsOptional()
  @IsArray()
  tags?: string[]

  @IsOptional()
  metadata?: Record<string, unknown>
}
