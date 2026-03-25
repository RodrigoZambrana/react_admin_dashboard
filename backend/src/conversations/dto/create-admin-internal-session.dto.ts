import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateAdminInternalSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenantKey?: string

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  message!: string
}
