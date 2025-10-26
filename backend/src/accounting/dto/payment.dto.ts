import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { PaymentStatus, PaymentType } from '@prisma/client'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

export class PaymentListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageIndex?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number

  @IsOptional()
  @IsString()
  @IsSafeString()
  query?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId?: number

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus

  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsString()
  @IsIn(['date', 'amount', 'status', 'type', 'order'])
  sortKey?: 'date' | 'amount' | 'status' | 'type' | 'order'

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc'
}

export class PaymentBaseDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentMethodId?: number | null

  @IsOptional()
  @IsString()
  @IsSafeString()
  method?: string | null

  @IsOptional()
  @IsString()
  @IsSafeString()
  reference?: string | null

  @IsOptional()
  @IsString()
  @IsSafeString()
  notes?: string | null

  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus

  @IsOptional()
  @IsDateString()
  date?: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  currency?: string
}

export class PaymentAttachmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number

  @IsString()
  @IsSafeString()
  name!: string

  @IsOptional()
  @IsString()
  @IsSafeString()
  type?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  size?: number | null

  @IsOptional()
  @IsString()
  content?: string | null
}

export class CreatePaymentDto extends PaymentBaseDto {
  @IsInt()
  @Min(1)
  orderId!: number

  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  amount!: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAttachmentDto)
  attachments?: PaymentAttachmentDto[]
}

export class UpdatePaymentDto extends PaymentBaseDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  amount?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAttachmentDto)
  attachments?: PaymentAttachmentDto[]
}
