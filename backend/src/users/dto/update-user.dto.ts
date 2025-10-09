import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsSafeString()
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsSafeString()
  lastName?: string

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  @IsSafeString()
  email?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  img?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  role?: 'superadmin' | 'admin' | 'user'

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsSafeString()
  country?: string

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @IsSafeString()
  @Matches(/^[A-Z]{0,5}$/i, { message: 'text.validation.invalidCharacters' })
  countryCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsSafeString()
  city?: string
}
