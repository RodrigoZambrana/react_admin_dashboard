import { IsBoolean, IsOptional, IsString, IsObject } from 'class-validator'

export class UpdateFlagsDto {
  @IsOptional()
  @IsString()
  threadRemoteId?: string

  @IsOptional()
  @IsString()
  mailbox?: string

  @IsOptional()
  @IsBoolean()
  seen?: boolean

  @IsOptional()
  @IsBoolean()
  starred?: boolean

  @IsOptional()
  @IsBoolean()
  spam?: boolean

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
