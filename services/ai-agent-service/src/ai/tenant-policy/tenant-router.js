import { buildTenantRuntimePolicy } from './runtime-tenant-policy.js'

export const buildTenantPolicyEnvelope = ({
  tenantKey = 'default',
  topicTaxonomy = [],
  quoteProfiles = [],
} = {}) =>
  buildTenantRuntimePolicy({
    tenantKey,
    topicTaxonomy,
    quoteProfiles,
  })
