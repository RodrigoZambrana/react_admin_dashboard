import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'

export class StartContactConversationDto {
  @IsIn(['customer', 'internal'])
  contactType!: 'customer' | 'internal'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenantKey?: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  message?: string
}
