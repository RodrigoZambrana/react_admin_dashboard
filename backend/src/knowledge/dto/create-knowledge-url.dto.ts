import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

const scopes = ['customer_public', 'admin_internal'] as const
const refreshPolicies = ['manual', 'daily', 'weekly', 'on_demand'] as const

export class CreateKnowledgeUrlDto {
  @IsOptional()
  @IsString()
  tenantKey?: string

  @IsIn(scopes)
  scope!: (typeof scopes)[number]

  @IsUrl({
    require_protocol: true,
  })
  @MaxLength(2048)
  url!: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsIn(refreshPolicies)
  refreshPolicy?: (typeof refreshPolicies)[number]

  @IsOptional()
  @IsBoolean()
  crawl?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  crawlMaxDepth?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  crawlMaxPages?: number

  @IsOptional()
  @IsBoolean()
  crawlSameDomainOnly?: boolean

  @IsOptional()
  @IsBoolean()
  crawlRespectRobots?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  crawlExclude?: string[]

  @IsOptional()
  metadata?: Record<string, unknown>
}
