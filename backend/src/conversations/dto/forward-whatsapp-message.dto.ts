import { Transform } from 'class-transformer'
import { IsString, MaxLength } from 'class-validator'

export class ForwardWhatsappMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  targetConversationId!: string
}
