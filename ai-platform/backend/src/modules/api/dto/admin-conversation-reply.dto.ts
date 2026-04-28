import { Transform } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class AdminConversationReplyDto {
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  body!: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsObject()
  aiSuggestionFeedback?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  attachments?: unknown[];
}
