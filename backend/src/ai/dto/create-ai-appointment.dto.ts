import { EventType } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateAiAppointmentDto {
  @IsString()
  @MaxLength(160)
  title!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsDateString()
  startAt!: string

  @IsOptional()
  @IsDateString()
  endAt?: string

  @IsOptional()
  @IsEnum(EventType)
  type?: EventType

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string

  @IsOptional()
  @Type(() => Number)
  customerId?: number

  @IsOptional()
  @Type(() => Number)
  projectId?: number

  @IsOptional()
  @Type(() => Number)
  taskId?: number

  @IsOptional()
  metadata?: Record<string, unknown>
}
