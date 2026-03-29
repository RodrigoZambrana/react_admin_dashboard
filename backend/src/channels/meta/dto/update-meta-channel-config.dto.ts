import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateMetaChannelConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsBoolean()
  messengerEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  instagramEnabled?: boolean

  @IsOptional()
  @IsString()
  publicBaseUrl?: string | null

  @IsOptional()
  @IsString()
  pageId?: string | null

  @IsOptional()
  @IsString()
  instagramBusinessAccountId?: string | null

  @IsOptional()
  @IsString()
  appId?: string | null

  @IsOptional()
  @IsString()
  verifyToken?: string | null

  @IsOptional()
  @IsString()
  appSecret?: string | null

  @IsOptional()
  @IsString()
  pageAccessToken?: string | null

  @IsOptional()
  @IsString()
  messengerPageAccessToken?: string | null

  @IsOptional()
  @IsString()
  instagramAccessToken?: string | null
}
