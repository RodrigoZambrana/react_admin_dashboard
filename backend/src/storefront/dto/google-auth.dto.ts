import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class StorefrontGoogleStartDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  returnPath?: string

  @IsOptional()
  @IsString()
  @IsIn(['login', 'recover', 'reauth'])
  purpose?: 'login' | 'recover' | 'reauth'
}
