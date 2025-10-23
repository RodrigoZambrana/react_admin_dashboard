import { Transform, Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

const transformStringArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

export class SendMessageAttachmentDto {
  @IsString()
  fileName!: string

  @IsOptional()
  @IsString()
  contentType?: string

  @IsString()
  content!: string
}

export class SendMessageDto {
  @IsString()
  subject!: string

  @IsArray()
  @ArrayMinSize(1)
  @Transform(transformStringArray, { toClassOnly: true })
  to!: string[]

  @IsOptional()
  @IsArray()
  @Transform(transformStringArray, { toClassOnly: true })
  cc?: string[]

  @IsOptional()
  @IsArray()
  @Transform(transformStringArray, { toClassOnly: true })
  bcc?: string[]

  @IsOptional()
  @IsArray()
  @Transform(transformStringArray, { toClassOnly: true })
  replyTo?: string[]

  @IsOptional()
  @IsString()
  replyToRemoteId?: string

  @IsOptional()
  @IsString()
  bodyHtml?: string

  @IsOptional()
  @IsString()
  bodyText?: string

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SendMessageAttachmentDto)
  attachments?: SendMessageAttachmentDto[]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @IsOptional()
  @IsString()
  fromAddress?: string

  @IsOptional()
  @IsString()
  fromName?: string

  @IsOptional()
  @IsString()
  queueId?: string

  @IsOptional()
  @IsString()
  queueSlug?: string
}
