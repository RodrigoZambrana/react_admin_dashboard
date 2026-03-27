import { Transform, Type } from 'class-transformer'
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

export class ConversationAiSuggestionFeedbackDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  candidateId!: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  targetMessageId?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  targetMessageText?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  suggestedText?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(['used', 'edited', 'discarded'])
  outcome?: 'used' | 'edited' | 'discarded'
}

export class RecordConversationAiSuggestionFeedbackDto {
  @ValidateNested()
  @Type(() => ConversationAiSuggestionFeedbackDto)
  feedback!: ConversationAiSuggestionFeedbackDto
}
