import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AsyncChatMessageDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  channel?: string;
}
