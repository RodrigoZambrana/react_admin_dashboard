import { IsOptional, IsString, MaxLength } from 'class-validator'

export class StorefrontGoogleStartDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  returnPath?: string
}
