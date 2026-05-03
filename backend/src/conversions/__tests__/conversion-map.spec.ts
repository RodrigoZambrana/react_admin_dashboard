import { describe, expect, it } from 'vitest'

import { resolveConversionMapEntry } from '../conversion-map'

describe('resolveConversionMapEntry', () => {
  it('maps purchase_completed to purchase', () => {
    const result = resolveConversionMapEntry('purchase_completed')
    expect(result?.canonicalName).toBe('purchase')
    expect(result?.requiresTransactionId).toBe(true)
  })

  it('maps form_submit to generate_lead', () => {
    const result = resolveConversionMapEntry('form_submit')
    expect(result?.canonicalName).toBe('generate_lead')
    expect(result?.requiresContactEvidence).toBe(true)
  })

  it('maps whatsapp_click to contact', () => {
    const result = resolveConversionMapEntry('whatsapp_click')
    expect(result?.canonicalName).toBe('contact')
    expect(result?.businessType).toBe('lead')
  })
})

