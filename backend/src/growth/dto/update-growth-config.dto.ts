import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateGrowthConfigDto {
  @IsOptional()
  @IsBoolean()
  googleAnalyticsEnabled?: boolean

  @IsOptional()
  @IsString()
  googleAnalyticsMeasurementId?: string | null

  @IsOptional()
  @IsBoolean()
  googleTagManagerEnabled?: boolean

  @IsOptional()
  @IsString()
  googleTagManagerContainerId?: string | null

  @IsOptional()
  @IsBoolean()
  googleAdsEnabled?: boolean

  @IsOptional()
  @IsString()
  googleAdsConversionId?: string | null

  @IsOptional()
  @IsString()
  googleAdsConversionLabel?: string | null

  @IsOptional()
  @IsString()
  googleSearchConsoleVerificationToken?: string | null

  @IsOptional()
  @IsBoolean()
  metaPixelEnabled?: boolean

  @IsOptional()
  @IsString()
  metaPixelId?: string | null

  @IsOptional()
  @IsBoolean()
  metaConversionsApiEnabled?: boolean

  @IsOptional()
  @IsString()
  metaConversionsApiToken?: string | null

  @IsOptional()
  @IsString()
  metaAdsAccountId?: string | null

  @IsOptional()
  @IsBoolean()
  contentInsightsEnabled?: boolean
}
