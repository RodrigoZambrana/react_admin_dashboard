import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AsyncChatTypingDto {
  @IsString()
  conversationId!: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isTyping?: boolean;
}
