import { IsOptional, IsString } from 'class-validator'

export class CreateKnowledgeCandidateDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsString()
  conversationId!: string

  @IsString()
  messageId!: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  summary?: string
}
