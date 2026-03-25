import { Transform } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

export class GetWebchatSessionDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  guestId?: string
}
