import { Transform } from 'class-transformer'
import { IsIn, IsOptional } from 'class-validator'

export class SetWhatsappChatMuteDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsIn(['off', '8h', '7d'])
  preset?: 'off' | '8h' | '7d'
}
