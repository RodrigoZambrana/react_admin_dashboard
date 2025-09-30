import { IsString, MinLength } from 'class-validator'

export class SignInDto {
  @IsString()
  userName!: string

  @IsString()
  @MinLength(6)
  password!: string
}

