import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateFlagsDto {
  @IsOptional()
  @IsString()
  threadRemoteId?: string

  @IsOptional()
  @IsBoolean()
  seen?: boolean

  @IsOptional()
  @IsBoolean()
  starred?: boolean

  @IsOptional()
  @IsBoolean()
  spam?: boolean
}
