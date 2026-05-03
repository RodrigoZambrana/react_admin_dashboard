import { SetMetadata } from '@nestjs/common'
import type { InsightsScope } from './insights.types'

export const INSIGHTS_SCOPES_KEY = 'insights_scopes'

export const InsightsScopes = (...scopes: InsightsScope[]) =>
  SetMetadata(INSIGHTS_SCOPES_KEY, scopes)

