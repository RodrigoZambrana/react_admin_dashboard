const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const singularizeAlias = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }
  if (normalized.endsWith('es') && normalized.length > 4) {
    return normalized.slice(0, -2)
  }
  if (normalized.endsWith('s') && normalized.length > 3) {
    return normalized.slice(0, -1)
  }
  return normalized
}

const isProductTopicAliasTooBroad = (entry, alias, normalizationValue) => {
  if (entry?.kind !== 'product_topic') {
    return false
  }

  const normalizedAlias = normalizeText(alias)
  if (!normalizedAlias || normalizedAlias.includes(' ')) {
    return false
  }

  if (normalizedAlias.length < 4) {
    return true
  }

  if (normalizationValue && normalizedAlias === normalizationValue) {
    return false
  }

  const familyLabel = normalizeText(entry?.familyLabel)
  const singularFamily = singularizeAlias(familyLabel)
  if (
    normalizedAlias === familyLabel ||
    (singularFamily && normalizedAlias === singularFamily)
  ) {
    return true
  }

  return false
}

const normalizeAliases = (entry) => {
  const aliases = new Set()
  const normalizationValue = normalizeText(entry?.normalizationValue)
  const addAlias = (value) => {
    const normalized = normalizeText(value)
    if (!normalized) {
      return
    }
    if (isProductTopicAliasTooBroad(entry, normalized, normalizationValue)) {
      return
    }
    aliases.add(normalized)
    const singular = singularizeAlias(normalized)
    if (
      singular &&
      !isProductTopicAliasTooBroad(entry, singular, normalizationValue)
    ) {
      aliases.add(singular)
    }
  }

  addAlias(entry?.label)
  if (Array.isArray(entry?.aliases)) {
    for (const alias of entry.aliases) {
      addAlias(alias)
    }
  }

  return Array.from(aliases).sort((left, right) => right.length - left.length)
}

const normalizeNormalizationValue = (entry) => {
  const normalized = normalizeText(entry?.normalizationValue)
  return normalized || null
}

export const normalizeTenantTopicTaxonomy = (entries = []) =>
  Array.isArray(entries)
    ? entries
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          key: String(entry.key || '').trim(),
          label: String(entry.label || '').trim(),
          kind:
            entry.kind === 'product_family' ||
            entry.kind === 'product_variant' ||
            entry.kind === 'product_topic'
              ? entry.kind
              : 'product_topic',
          aliases: normalizeAliases(entry),
          normalizationValue: normalizeNormalizationValue(entry),
          parentKeys: Array.isArray(entry.parentKeys)
            ? entry.parentKeys
                .filter((value) => typeof value === 'string' && value.trim())
                .map((value) => value.trim())
            : [],
          parentLabels: Array.isArray(entry.parentLabels)
            ? entry.parentLabels
                .filter((value) => typeof value === 'string' && value.trim())
                .map((value) => value.trim())
            : [],
          familyLabel:
            typeof entry.familyLabel === 'string' && entry.familyLabel.trim()
              ? entry.familyLabel.trim()
              : null,
          tags: Array.isArray(entry.tags)
            ? entry.tags
                .filter((value) => typeof value === 'string' && value.trim())
                .map((value) => value.trim())
            : [],
        }))
        .filter((entry) => entry.key && entry.label && entry.aliases.length > 0)
    : []

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const isContextualTopicDescriptorMatch = (match, input = '') => {
  const alias = normalizeText(match?.matchedAlias || '')
  if (match?.kind !== 'product_topic' || !alias || alias.includes(' ')) {
    return false
  }

  return new RegExp(
    `\\b(?:en|con|sin|de|otro\\s+(?:con|de)|otra\\s+(?:con|de))\\s+${escapeRegex(alias)}\\b`,
    'i',
  ).test(String(input || ''))
}

const resolveNormalizationValue = (entry) => {
  if (entry.normalizationValue) {
    return entry.normalizationValue
  }
  if (entry.kind === 'product_family' || entry.kind === 'product_variant') {
    return normalizeText(entry.label)
  }
  return null
}

const matchAliasScore = (normalizedTextInput, alias) => {
  if (!alias) {
    return -1
  }
  const paddedInput = ` ${normalizedTextInput} `
  const paddedAlias = ` ${alias} `
  if (!paddedInput.includes(paddedAlias)) {
    return -1
  }

  const tokenCount = alias.split(/\s+/).filter(Boolean).length
  return tokenCount * 20 + alias.length
}

export const findTenantTopicMatches = (value, taxonomy = [], options = {}) => {
  const normalizedInput = normalizeText(value)
  if (!normalizedInput) {
    return []
  }

  const allowedKinds = Array.isArray(options?.kinds)
    ? new Set(options.kinds)
    : null
  const matches = []

  for (const entry of normalizeTenantTopicTaxonomy(taxonomy)) {
    if (allowedKinds && !allowedKinds.has(entry.kind)) {
      continue
    }

    let bestAlias = null
    let bestScore = -1
    for (const alias of entry.aliases) {
      const score = matchAliasScore(normalizedInput, alias)
      if (score > bestScore) {
        bestScore = score
        bestAlias = alias
      }
    }

    if (bestAlias) {
      matches.push({
        ...entry,
        matchedAlias: bestAlias,
        position: normalizedInput.indexOf(bestAlias),
        score:
          bestScore +
          (entry.kind === 'product_family'
            ? 6
            : entry.kind === 'product_topic'
              ? 4
              : 2),
      })
    }
  }

  const limit =
    typeof options?.limit === 'number' && Number.isFinite(options.limit)
      ? options.limit
      : 3

  return matches
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return right.label.length - left.label.length
    })
    .slice(0, limit)
}

export const findBestTenantTopicMatch = (value, taxonomy = [], options = {}) =>
  findTenantTopicMatches(value, taxonomy, { ...options, limit: 1 })[0] || null

export const buildTenantTopicNormalizationRules = (taxonomy = []) =>
  normalizeTenantTopicTaxonomy(taxonomy)
    .flatMap((entry) => {
      const replacement = resolveNormalizationValue(entry)
      if (!replacement) {
        return []
      }

      return entry.aliases
        .filter((alias) => alias && alias !== replacement)
        .map((alias) => ({
          key: entry.key,
          alias,
          replacement,
          kind: entry.kind,
          familyLabel: entry.familyLabel,
          pattern: new RegExp(`\\b${escapeRegex(alias)}\\b`, 'g'),
        }))
    })
    .sort((left, right) => right.alias.length - left.alias.length)

export const hasTenantTopicSignal = (value, taxonomy = []) =>
  Boolean(findBestTenantTopicMatch(value, taxonomy))

export const extractTenantFamilyLabel = (value, taxonomy = []) => {
  const match = findBestTenantTopicMatch(value, taxonomy)
  if (!match) {
    return null
  }

  if (match.kind === 'product_family') {
    return match.label
  }

  return match.familyLabel || match.parentLabels[0] || null
}

export const extractTenantVariantLabels = (value, taxonomy = []) =>
  findTenantTopicMatches(value, taxonomy, {
    kinds: ['product_variant'],
    limit: 8,
  })
    .sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return left.label.localeCompare(right.label, undefined, {
        sensitivity: 'base',
      })
    })
    .map((entry) => entry.label)

export const normalizeCustomerTopicText = normalizeText
