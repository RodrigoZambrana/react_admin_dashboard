export const CUSTOMER_CAPABILITY_PROFILE_PRESETS = {
  full_assistant: {
    content: 'enabled',
    commerce: 'enabled',
    scheduling: 'enabled',
  },
  ecommerce_content: {
    content: 'enabled',
    commerce: 'enabled',
    scheduling: 'handoff_only',
  },
  scheduling_content: {
    content: 'enabled',
    commerce: 'handoff_only',
    scheduling: 'enabled',
  },
  content_only: {
    content: 'enabled',
    commerce: 'handoff_only',
    scheduling: 'handoff_only',
  },
  custom: {
    content: 'enabled',
    commerce: 'enabled',
    scheduling: 'enabled',
  },
}

const normalizeMode = (value) => {
  const normalized = String(value || '').trim()
  return ['enabled', 'deterministic_only', 'handoff_only'].includes(normalized)
    ? normalized
    : 'enabled'
}

const normalizeProfile = (value) => {
  const normalized = String(value || '').trim()
  return Object.prototype.hasOwnProperty.call(
    CUSTOMER_CAPABILITY_PROFILE_PRESETS,
    normalized,
  )
    ? normalized
    : 'full_assistant'
}

export const resolveCustomerCapabilityRuntime = (config = null) => {
  const profile = normalizeProfile(config?.customerCapabilityProfile)
  const preset =
    CUSTOMER_CAPABILITY_PROFILE_PRESETS[profile] ||
    CUSTOMER_CAPABILITY_PROFILE_PRESETS.full_assistant

  return {
    profile,
    modes: {
      content:
        profile === 'custom'
          ? normalizeMode(config?.customerContentMode)
          : preset.content,
      commerce:
        profile === 'custom'
          ? normalizeMode(config?.customerCommerceMode)
          : preset.commerce,
      scheduling:
        profile === 'custom'
          ? normalizeMode(config?.customerSchedulingMode)
          : preset.scheduling,
    },
  }
}

export const getCustomerCapabilityForIntent = (intentKey = null) => {
  switch (String(intentKey || '')) {
    case 'customer.topic_info':
    case 'customer.contact_info':
    case 'customer.product_info':
      return 'content'
    case 'customer.price_inquiry':
    case 'customer.quote':
    case 'customer.order_status':
      return 'commerce'
    case 'customer.schedule_request':
    case 'customer.confirmation':
    case 'customer.cancellation':
      return 'scheduling'
    default:
      return null
  }
}

export const getCustomerCapabilityMode = (runtimeConfig = null, intentKey = null) => {
  const capability = getCustomerCapabilityForIntent(intentKey)
  if (!capability) {
    return null
  }
  const resolved = resolveCustomerCapabilityRuntime(runtimeConfig)
  return resolved.modes[capability]
}

export const capabilityModeBlocksAutomaticResolution = (mode = null) =>
  String(mode || '') === 'handoff_only'

export const capabilityModeBlocksProviderEnhancements = (mode = null) =>
  ['deterministic_only', 'handoff_only'].includes(String(mode || ''))
