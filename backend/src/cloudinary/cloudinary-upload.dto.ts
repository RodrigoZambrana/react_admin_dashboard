import { IsEnum, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'

export enum CloudinaryUploadMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export class CloudinarySignUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number

  @IsEnum(CloudinaryUploadMediaType)
  type!: CloudinaryUploadMediaType
}

export interface CloudinarySignUploadResponse {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
  resourceType: CloudinaryUploadMediaType
}

