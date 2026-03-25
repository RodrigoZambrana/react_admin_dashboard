import { Transform } from 'class-transformer'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class ReplyConversationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  body!: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  kind?: string
}
