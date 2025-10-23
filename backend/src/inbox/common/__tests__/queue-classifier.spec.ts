import { describe, expect, it } from 'vitest'
import { resolveQueueSlug } from '../queue-classifier'

const baseConfig = {
  defaultQueue: 'general',
  headerKey: 'x-queue',
  domainQueues: {
    'ventas.acme.com': 'sales',
    'support.acme.com': 'support',
  },
  aliasQueues: {
    'noc@acme.com': 'noc',
  },
  subjectRules: [
    { regex: /factura|billing/i, queue: 'billing' },
    { regex: /incident|alert/i, queue: 'noc' },
  ],
  labelQueues: {
    urgent: 'noc',
  },
}

describe('resolveQueueSlug', () => {
  it('resolves header first', () => {
    const result = resolveQueueSlug(
      {
        headers: { 'x-queue': 'support' },
      },
      baseConfig,
    )
    expect(result).toEqual({ slug: 'support', matchedRule: 'header' })
  })

  it('matches domain', () => {
    const result = resolveQueueSlug(
      {
        to: [{ address: 'foo@ventas.acme.com' }],
      },
      baseConfig,
    )
    expect(result).toEqual({ slug: 'sales', matchedRule: 'domain' })
  })

  it('matches alias', () => {
    const result = resolveQueueSlug(
      {
        cc: [{ address: 'noc@acme.com' }],
      },
      baseConfig,
    )
    expect(result).toEqual({ slug: 'noc', matchedRule: 'alias' })
  })

  it('matches label', () => {
    const result = resolveQueueSlug(
      {
        labels: ['Urgent'],
      },
      baseConfig,
    )
    expect(result).toEqual({ slug: 'noc', matchedRule: 'label' })
  })

  it('matches subject regex', () => {
    const result = resolveQueueSlug(
      {
        subject: 'Factura pendiente',
      },
      baseConfig,
    )
    expect(result).toEqual({ slug: 'billing', matchedRule: 'subject' })
  })

  it('falls back to default', () => {
    const result = resolveQueueSlug({}, baseConfig)
    expect(result).toEqual({ slug: 'general', matchedRule: 'default' })
  })
})
