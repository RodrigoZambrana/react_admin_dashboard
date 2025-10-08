import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName!: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string

  @IsEmail()
  @MaxLength(120)
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lang?: string
}
