import { IsIn, IsOptional, IsString } from 'class-validator'

export class ReviewKnowledgeConversationBundleDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject'

  @IsOptional()
  @IsString()
  summary?: string
}
