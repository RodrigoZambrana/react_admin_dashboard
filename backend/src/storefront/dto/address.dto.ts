import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class StorefrontAddressDto {
  @IsString()
  @MaxLength(120)
  street!: string

  @IsString()
  @Matches(/^[0-9A-Za-z\- ]+$/, { message: 'storefront.address.invalid_number' })
  @MaxLength(30)
  number!: string

  @IsString()
  @MaxLength(120)
  city!: string

  @IsString()
  @MaxLength(120)
  department!: string

  @IsString()
  @MaxLength(120)
  country!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(120)
  corner?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apartment?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  comments?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean | null
}
