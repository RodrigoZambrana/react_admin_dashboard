import type { QueueClassificationInput } from './message-identity'

export type QueueRuleConfig = {
  headerKey?: string
  domainQueues?: Record<string, string>
  aliasQueues?: Record<string, string>
  subjectRules?: Array<{ regex: RegExp; queue: string }>
  labelQueues?: Record<string, string>
  defaultQueue: string
}

export type QueueResolution = {
  slug: string
  matchedRule: string
}

const DEFAULT_CONFIG: QueueRuleConfig = {
  headerKey: 'x-queue',
  domainQueues: {},
  aliasQueues: {},
  subjectRules: [],
  labelQueues: {},
  defaultQueue: 'general',
}

export function resolveQueueSlug(
  input: QueueClassificationInput,
  config: QueueRuleConfig = DEFAULT_CONFIG,
): QueueResolution {
  const rules = normalizeConfig(config)

  const headerValue = lookupHeader(input.headers, rules.headerKey)
  if (headerValue) {
    return { slug: headerValue, matchedRule: 'header' }
  }

  const domainMatch = matchDomain(input, rules.domainQueues)
  if (domainMatch) {
    return { slug: domainMatch, matchedRule: 'domain' }
  }

  const aliasMatch = matchAlias(input, rules.aliasQueues)
  if (aliasMatch) {
    return { slug: aliasMatch, matchedRule: 'alias' }
  }

  const labelMatch = matchLabel(input, rules.labelQueues)
  if (labelMatch) {
    return { slug: labelMatch, matchedRule: 'label' }
  }

  const subjectMatch = matchSubject(input.subject, rules.subjectRules)
  if (subjectMatch) {
    return { slug: subjectMatch, matchedRule: 'subject' }
  }

  return { slug: rules.defaultQueue, matchedRule: 'default' }
}

function normalizeConfig(config: QueueRuleConfig): Required<QueueRuleConfig> {
  return {
    headerKey: config.headerKey ?? DEFAULT_CONFIG.headerKey!,
    domainQueues: config.domainQueues ?? {},
    aliasQueues: config.aliasQueues ?? {},
    subjectRules: (config.subjectRules ?? []).map((rule) => ({
      queue: rule.queue,
      regex: rule.regex,
    })),
    labelQueues: config.labelQueues ?? {},
    defaultQueue: config.defaultQueue || DEFAULT_CONFIG.defaultQueue,
  }
}

function lookupHeader(headers: Record<string, string> | undefined, headerKey?: string) {
  if (!headers || !headerKey) {
    return null
  }
  const normalizedKey = headerKey.toLowerCase()
  const raw = headers[normalizedKey]
  if (!raw) {
    return null
  }
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .find(Boolean) ?? null
}

function matchDomain(
  input: QueueClassificationInput,
  domainQueues: Record<string, string>,
) {
  if (!domainQueues || Object.keys(domainQueues).length === 0) {
    return null
  }
  const addresses = collectAddresses([input.to, input.cc, input.bcc])
  for (const address of addresses) {
    const domain = extractDomain(address)
    if (!domain) continue
    const matchedQueue = findMatchingDomain(domain, domainQueues)
    if (matchedQueue) {
      return matchedQueue
    }
  }
  return null
}

function matchAlias(
  input: QueueClassificationInput,
  aliasQueues: Record<string, string>,
) {
  if (!aliasQueues || Object.keys(aliasQueues).length === 0) {
    return null
  }
  const addresses = collectAddresses([input.to, input.cc, input.bcc])
  for (const address of addresses) {
    const normalized = address.toLowerCase()
    if (aliasQueues[normalized]) {
      return aliasQueues[normalized]
    }
  }
  return null
}

function matchLabel(
  input: QueueClassificationInput,
  labelQueues: Record<string, string>,
) {
  if (!labelQueues || !input.labels || input.labels.length === 0) {
    return null
  }
  for (const label of input.labels) {
    const normalized = label.toLowerCase()
    if (labelQueues[normalized]) {
      return labelQueues[normalized]
    }
  }
  return null
}

function matchSubject(
  subject: string | null | undefined,
  subjectRules: Array<{ regex: RegExp; queue: string }>,
) {
  if (!subject) {
    return null
  }
  for (const rule of subjectRules) {
    if (rule.regex.test(subject)) {
      return rule.queue
    }
  }
  return null
}

function collectAddresses(
  sets: Array<Array<{ address?: string | null }> | undefined>,
): string[] {
  const addresses: string[] = []
  for (const set of sets) {
    if (!set) continue
    for (const entry of set) {
      const address = entry?.address
      if (!address) continue
      addresses.push(address)
    }
  }
  return addresses
}

function extractDomain(address: string) {
  const normalized = address.toLowerCase().trim()
  const atIndex = normalized.lastIndexOf('@')
  if (atIndex === -1 || atIndex === normalized.length - 1) {
    return null
  }
  return normalized.slice(atIndex + 1)
}

function findMatchingDomain(domain: string, map: Record<string, string>) {
  const segments = domain.split('.')
  for (let i = 0; i < segments.length; i += 1) {
    const candidate = segments.slice(i).join('.')
    if (map[candidate]) {
      return map[candidate]
    }
  }
  return null
}
