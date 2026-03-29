import { Transform } from 'class-transformer'
import { IsBoolean } from 'class-validator'

export class ToggleWhatsappChatPinDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  pinned!: boolean
}
