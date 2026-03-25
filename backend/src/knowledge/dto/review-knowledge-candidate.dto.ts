import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator'

const actions = ['approve', 'reject'] as const
const scopes = ['customer_public', 'admin_internal'] as const

export class ReviewKnowledgeCandidateDto {
  @IsIn(actions)
  action!: (typeof actions)[number]

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  promoteToDocument?: boolean

  @IsOptional()
  @IsIn(scopes)
  scope?: (typeof scopes)[number]

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsString()
  content?: string
}
