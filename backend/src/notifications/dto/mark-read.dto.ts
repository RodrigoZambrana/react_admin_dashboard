import { Transform } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional } from 'class-validator'

export class MarkNotificationsReadDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((entry) => {
            const numeric = Number(entry)
            return Number.isFinite(numeric) ? numeric : null
          })
          .filter((entry) => entry !== null)
      : undefined,
  )
  ids?: number[]

  @Transform(({ value }) => {
    if (value === undefined) return undefined
    if (typeof value === 'string') {
      return value === 'true' || value === '1'
    }
    return Boolean(value)
  })
  @IsOptional()
  @IsBoolean()
  markAll?: boolean
}
