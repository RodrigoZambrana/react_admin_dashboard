import { Transform } from 'class-transformer'
import { IsString, MaxLength } from 'class-validator'

export class ReactWebchatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(16)
  emoji!: string
}
