import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Matches, Min } from 'class-validator'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

export class StorefrontCreateOrderReviewDto {
  @IsInt()
  @Min(1)
  productId!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  variantId?: number

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsSafeString()
  @MaxLength(120)
  title?: string

  @IsString()
  @Matches(/\S/, { message: 'text.validation.invalidCharacters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsSafeString()
  @MaxLength(2_000)
  comment!: string
}
