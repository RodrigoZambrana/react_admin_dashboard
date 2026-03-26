import { describe, expect, it } from 'vitest'
import {
  getCapabilityCatalog,
  resolveCapabilitiesFromGroups,
  resolveUserCapabilityEnvelope,
} from '../capabilities'

describe('user capabilities', () => {
  it('resolves capability groups into a stable envelope', () => {
    expect(resolveCapabilitiesFromGroups(['sales'])).toEqual([
      'conversations.manage',
      'customers.manage',
      'orders.manage',
      'quotes.manage',
      'aberturas.quote',
    ])
  })

  it('preserves legacy role behavior when no explicit groups exist', () => {
    const envelope = resolveUserCapabilityEnvelope({
      role: 'OPS',
    })

    expect(envelope.source).toBe('legacy_role')
    expect(envelope.capabilityEnvelope).toContain('catalog.manage')
    expect(envelope.capabilityEnvelope).toContain('aberturas.register')
  })

  it('switches to explicit mode when the user defines groups or direct capabilities', () => {
    const envelope = resolveUserCapabilityEnvelope({
      role: 'ADMIN',
      capabilityGroups: ['support'],
      directCapabilities: ['users.manage'],
    })

    expect(envelope.source).toBe('explicit')
    expect(envelope.capabilityEnvelope).toContain('conversations.manage')
    expect(envelope.capabilityEnvelope).toContain('users.manage')
    expect(envelope.capabilityEnvelope).not.toContain('ai.settings.manage')
  })

  it('accepts persisted prisma enums when rebuilding the explicit envelope from session data', () => {
    const envelope = resolveUserCapabilityEnvelope({
      role: 'ADMIN',
      capabilityGroups: ['SALES'],
      directCapabilities: ['PAYMENTS_MANAGE'],
    })

    expect(envelope.source).toBe('explicit')
    expect(envelope.capabilityGroups).toEqual(['sales'])
    expect(envelope.directCapabilities).toEqual(['payments.manage'])
    expect(envelope.capabilityEnvelope).toContain('aberturas.quote')
    expect(envelope.capabilityEnvelope).toContain('payments.manage')
  })

  it('exposes a catalog with groups and capabilities for the admin ABM', () => {
    const catalog = getCapabilityCatalog()

    expect(catalog.capabilities.length).toBeGreaterThan(5)
    expect(catalog.groups.some((group) => group.value === 'operations')).toBe(true)
    expect(
      catalog.groups.find((group) => group.value === 'operations')?.capabilities,
    ).toContain('aberturas.register')
  })
})
