import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class AdminConversationReplyDto {
  @IsString()
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
