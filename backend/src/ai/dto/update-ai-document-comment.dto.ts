import { IsOptional, IsString } from 'class-validator'

export class UpdateAiDocumentCommentDto {
  @IsOptional()
  @IsString()
  comment?: string
}
