import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

const aiProviders = ['mock', 'openai', 'ollama'] as const

export class UpdateAiRuntimeConfigDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsIn(aiProviders)
  provider?: (typeof aiProviders)[number]

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string

  @IsOptional()
  @IsString()
  openAiApiKey?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlySpendingLimitUsd?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentUsageUsd?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  warningThresholdPercent?: number

  @IsOptional()
  @IsString()
  usageMessage?: string | null
}
