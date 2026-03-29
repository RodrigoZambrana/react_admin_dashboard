import { Transform } from 'class-transformer'
import { IsBoolean } from 'class-validator'

export class ToggleWhatsappChatReadDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  read!: boolean
}
