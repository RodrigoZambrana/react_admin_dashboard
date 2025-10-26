import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { WorkOrderStatus } from '@prisma/client'

export class ProductionOrderListQueryDto {
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
  search?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId?: number

  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number

  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'scheduledAt'])
  sortKey?: 'createdAt' | 'scheduledAt'

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc'
}

export class CreateProductionOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId!: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workOrderId?: number

  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number | null

  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null

  @IsOptional()
  @IsDateString()
  startedAt?: string | null

  @IsOptional()
  @IsDateString()
  completedAt?: string | null

  @IsOptional()
  @IsDateString()
  deliveredAt?: string | null

  @IsOptional()
  @IsString()
  notes?: string | null

  @IsOptional()
  @IsString()
  metadata?: string | null
}

export class UpdateProductionOrderDto {
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number | null

  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null

  @IsOptional()
  @IsDateString()
  startedAt?: string | null

  @IsOptional()
  @IsDateString()
  completedAt?: string | null

  @IsOptional()
  @IsDateString()
  deliveredAt?: string | null

  @IsOptional()
  @IsString()
  notes?: string | null

  @IsOptional()
  @IsString()
  metadata?: string | null
}
