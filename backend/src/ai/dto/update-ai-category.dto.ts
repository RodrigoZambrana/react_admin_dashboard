import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class UpdateAiCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number
}
