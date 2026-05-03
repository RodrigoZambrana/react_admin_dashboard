import { describe, expect, it } from 'vitest'

import {
  normalizeAnalyticsEventCategory,
  normalizeAnalyticsEventName,
} from '../event-taxonomy'

describe('analytics event taxonomy', () => {
  it('treats canonical purchase as a conversion event', () => {
    expect(normalizeAnalyticsEventCategory(undefined, 'purchase')).toBe('conversion')
    expect(normalizeAnalyticsEventCategory(undefined, 'view_item')).toBe('engagement')
  })

  it('keeps unknown legacy aliases unchanged', () => {
    expect(normalizeAnalyticsEventName('view_product')).toBe('view_product')
    expect(normalizeAnalyticsEventName('purchase_completed')).toBe('purchase_completed')
  })
})
