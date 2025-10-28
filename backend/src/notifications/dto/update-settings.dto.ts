import { Transform, Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { NotificationAudience, NotificationChannel, NotificationEventType, Role } from '@prisma/client'

const ROLE_VALUES = Object.values(Role) as Role[]

export class NotificationSettingUpdateItemDto {
  @IsEnum(NotificationEventType)
  eventType!: NotificationEventType

  @IsEnum(NotificationAudience)
  audience!: NotificationAudience

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel

  @IsBoolean()
  enabled!: boolean

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true })
  @Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return []
    }
    const normalized: Role[] = []
    for (const entry of value) {
      const upper = String(entry).toUpperCase() as Role
      if (ROLE_VALUES.includes(upper) && !normalized.includes(upper)) {
        normalized.push(upper)
      }
    }
    return normalized
  })
  roles?: Role[]

  @IsOptional()
  @IsString()
  @MaxLength(200)
  templateKey?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emailSubject?: string | null

  @IsOptional()
  localeOverrides?: Record<string, unknown> | null
}

export class UpdateNotificationSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationSettingUpdateItemDto)
  settings!: NotificationSettingUpdateItemDto[]
}
