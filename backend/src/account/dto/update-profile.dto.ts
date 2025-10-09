import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsSafeString()
  firstName!: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsSafeString()
  lastName?: string

  @IsEmail()
  @MaxLength(120)
  @IsSafeString()
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @IsSafeString()
  lang?: string
}
