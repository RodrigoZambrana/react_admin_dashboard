import { Type } from 'class-transformer'
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export enum MediaUploadType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export class LocalMediaUploadDto {
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  productId!: number

  @IsEnum(MediaUploadType)
  type!: MediaUploadType

  @IsOptional()
  @IsString()
  alt?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  order?: number
}
