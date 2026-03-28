import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

const aiProviders = ['mock', 'openai', 'ollama'] as const
const customerCapabilityProfiles = [
  'full_assistant',
  'ecommerce_content',
  'scheduling_content',
  'content_only',
  'custom',
] as const
const capabilityModes = ['enabled', 'deterministic_only', 'handoff_only'] as const

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

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminInternalPrompt?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customerPublicPrompt?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  customerGreetingDefault?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  customerGreetingMorning?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  customerGreetingAfternoon?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  customerGreetingConsultation?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  customerGreetingHelp?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(240)
  adminGreetingDefault?: string | null

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  customerGroundedRewriteEnabled?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(400)
  customerGroundedRewriteMaxChars?: number | null

  @IsOptional()
  @IsIn(customerCapabilityProfiles)
  customerCapabilityProfile?: (typeof customerCapabilityProfiles)[number]

  @IsOptional()
  @IsIn(capabilityModes)
  customerContentMode?: (typeof capabilityModes)[number]

  @IsOptional()
  @IsIn(capabilityModes)
  customerCommerceMode?: (typeof capabilityModes)[number]

  @IsOptional()
  @IsIn(capabilityModes)
  customerSchedulingMode?: (typeof capabilityModes)[number]

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  customerWordingOverridesJson?: string | null
}
