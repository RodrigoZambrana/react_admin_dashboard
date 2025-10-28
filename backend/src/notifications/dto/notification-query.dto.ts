import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator'
import { NotificationChannel, NotificationEventType } from '@prisma/client'

export class NotificationQueryDto {
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsOptional()
  @IsNumber()
  page?: number

  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsOptional()
  @IsNumber()
  pageSize?: number

  @Transform(({ value }) => (value !== undefined ? String(value).toUpperCase() : undefined))
  @IsOptional()
  @IsEnum(NotificationEventType)
  eventType?: NotificationEventType

  @Transform(({ value }) => (value !== undefined ? String(value).toUpperCase() : undefined))
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel

  @Transform(({ value }) => {
    if (value === undefined) return undefined
    if (typeof value === 'string') {
      return value === 'true' || value === '1'
    }
    return Boolean(value)
  })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean

  @Transform(({ value }) => {
    if (!value) return undefined
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  })
  @IsOptional()
  since?: Date
}
