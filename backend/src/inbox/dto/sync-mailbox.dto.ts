import { Transform } from 'class-transformer'
import { IsArray, IsOptional, IsString, Max, Min } from 'class-validator'

const transformStringArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

const transformNumber = ({ value }: { value: unknown }) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const transformDate = ({ value }: { value: unknown }) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}

export class SyncMailboxDto {
  @IsOptional()
  @IsArray()
  @Transform(transformStringArray, { toClassOnly: true })
  mailboxes?: string[]

  @IsOptional()
  @Transform(transformNumber, { toClassOnly: true })
  @Min(1)
  @Max(500)
  limit?: number

  @IsOptional()
  @IsString()
  cursor?: string | null

  @IsOptional()
  @Transform(transformDate, { toClassOnly: true })
  since?: Date
}
