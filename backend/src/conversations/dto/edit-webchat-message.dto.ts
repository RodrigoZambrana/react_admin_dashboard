import { Transform } from 'class-transformer'
import { IsString, MaxLength } from 'class-validator'

export class EditWebchatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  body!: string
}
