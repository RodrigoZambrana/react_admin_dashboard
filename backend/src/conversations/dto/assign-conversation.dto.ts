import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class AssignConversationDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  userId!: number

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  notes?: string
}
