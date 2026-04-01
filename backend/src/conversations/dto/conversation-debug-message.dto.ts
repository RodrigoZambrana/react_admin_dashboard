import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { ConversationMessageAttachmentDto } from './conversation-message-attachment.dto'

export class ConversationDebugMessageDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  text?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30000)
  delayMs?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageAttachmentDto)
  attachments?: ConversationMessageAttachmentDto[]
}
