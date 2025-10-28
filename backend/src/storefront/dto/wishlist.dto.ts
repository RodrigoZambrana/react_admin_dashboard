import { IsInt, Min } from 'class-validator'

export class StorefrontAddWishlistItemDto {
  @IsInt()
  @Min(1)
  productId!: number
}
