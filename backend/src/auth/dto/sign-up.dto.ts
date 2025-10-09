import { IsEmail, IsOptional, IsString } from 'class-validator'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'
import { IsStrongPassword } from '../../common/validation/password-strength.decorator'

export class SignUpDto {
  @IsString()
  @IsSafeString()
  name!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  lastName?: string

  @IsEmail()
  @IsSafeString()
  email!: string

  @IsString()
  @IsStrongPassword()
  password!: string
}
