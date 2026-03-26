import { IsEmail, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator'

export class CreateAiCustomerDto {
  @IsString()
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string

  @IsOptional()
  @IsString()
  preferredLocale?: string
}
