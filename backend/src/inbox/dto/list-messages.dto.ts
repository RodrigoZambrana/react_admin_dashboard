import { Transform } from 'class-transformer'
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseDate = (value: unknown) => {
  if (typeof value === 'string' || value instanceof Date) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  return undefined
}

export class ListMessagesQueryDto {
  @IsString()
  mailbox!: string

  @IsOptional()
  @IsString()
  cursor?: string

  @IsOptional()
  @Transform(({ value }) => parseNumber(value), { toClassOnly: true })
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @IsOptional()
  @Transform(({ value }) => parseDate(value), { toClassOnly: true })
  @IsDate()
  since?: Date
}
