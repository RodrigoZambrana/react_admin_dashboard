import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { ConversationAiSuggestionFeedbackDto } from './conversation-ai-suggestion-feedback.dto'
import { ConversationMessageAttachmentDto } from './conversation-message-attachment.dto'

export class ReplyConversationDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  body?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  kind?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => ConversationAiSuggestionFeedbackDto)
  aiSuggestionFeedback?: ConversationAiSuggestionFeedbackDto

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageAttachmentDto)
  attachments?: ConversationMessageAttachmentDto[]
}
