import { IsEmail, IsOptional, IsString, MaxLength, Matches } from 'class-validator'
import type { Role } from '../../auth/roles.decorator'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

type RoleInput = Role | Lowercase<Role>

export class CreateUserDto {
  @IsString()
  @MaxLength(120)
  @IsSafeString()
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsSafeString()
  lastName?: string

  @IsEmail()
  @MaxLength(254)
  @IsSafeString()
  email!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  img?: string

  @IsOptional()
  @IsString()
  role?: RoleInput

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
