import { EventType } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateAiAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsDateString()
  startAt?: string

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
}
