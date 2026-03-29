import { Transform } from 'class-transformer'
import { IsBoolean } from 'class-validator'

export class ToggleWhatsappMessageStarDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  starred!: boolean
}
