import { IsIn, IsOptional, IsString } from 'class-validator'

export class ReviewKnowledgeNegativeExampleDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject'

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsString()
  correctedText?: string
}
