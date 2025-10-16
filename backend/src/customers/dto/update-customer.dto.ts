import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

class CustomerStatusPayloadDto {
  @IsOptional()
  @IsInt()
  id?: number

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  color?: string
}

class CustomerAddressDto {
  @IsOptional()
  @IsString()
  street?: string

  @IsOptional()
  @IsString()
  number?: string

  @IsOptional()
  @IsString()
  corner?: string

  @IsOptional()
  @IsString()
  apartment?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  comments?: string

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean
}

class CustomerPersonalInfoDto {
  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @Transform(({ value }) =>
    value === null || value === undefined
      ? undefined
      : typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  facebook?: string

  @IsOptional()
  @IsString()
  twitter?: string

  @IsOptional()
  @IsString()
  pinterest?: string

  @IsOptional()
  @IsString()
  linkedIn?: string

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[]

  @IsOptional()
  @IsString()
  birthday?: string
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsInt()
  id?: number

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @Transform(({ value }) =>
    value === null || value === undefined
      ? undefined
      : typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  img?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  facebook?: string

  @IsOptional()
  @IsString()
  twitter?: string

  @IsOptional()
  @IsString()
  pinterest?: string

  @IsOptional()
  @IsString()
  linkedIn?: string

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[]

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerPersonalInfoDto)
  personalInfo?: CustomerPersonalInfoDto

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerStatusPayloadDto)
  status?: CustomerStatusPayloadDto

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto

  @IsOptional()
  @IsInt()
  statusId?: number

  @IsOptional()
  @IsString()
  statusName?: string

  @IsOptional()
  @IsString()
  birthday?: string
}
