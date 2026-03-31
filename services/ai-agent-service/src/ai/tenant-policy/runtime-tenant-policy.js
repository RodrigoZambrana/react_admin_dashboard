import {
  normalizeTenantTopicTaxonomy,
  findBestTenantTopicMatch,
} from '../intents/customer-topic-taxonomy.js'
import {
  getStaticTenantConversationStatePolicy,
  getStaticTenantBusinessRules,
  getStaticTenantPolicy,
  getStaticTenantVocabulary,
} from '../../../../shared/tenant-policy/index.js'

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const uniqueStrings = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )

const normalizeRuleText = (value) => {
  const clean = String(value || '').trim()
  return clean || null
}

const normalizeLightFilterGuidance = (value = null) => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const translucentOption = normalizeRuleText(value.translucentOption)
  const opaqueOption = normalizeRuleText(value.opaqueOption)
  const comparisonSubject = normalizeRuleText(value.comparisonSubject)

  if (!translucentOption && !opaqueOption && !comparisonSubject) {
    return null
  }

  return {
    translucentOption,
    opaqueOption,
    comparisonSubject,
  }
}

const normalizeKnowledgeStatementPrefixes = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      match: normalizeRuleText(entry.match),
      replacement: normalizeRuleText(entry.replacement),
    }))
    .filter((entry) => entry.match && entry.replacement)

const normalizeQuoteAttributeFollowUpHints = (value = null) => {
  const entries = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([key]) => typeof key === 'string' && key.trim())
      .map(([key, hints]) => [
        key.trim(),
        uniqueStrings(hints),
      ])
      .filter(([, hints]) => hints.length > 0),
  )
}

const normalizeFaqSignals = (value = null) => {
  const signals = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    Object.entries(signals)
      .filter(([subtype]) => typeof subtype === 'string' && subtype.trim())
      .map(([subtype, entries]) => [subtype.trim(), uniqueStrings(entries)])
      .filter(([, entries]) => entries.length > 0),
  )
}

const normalizeBusinessFacts = (value = null) => {
  const facts = value && typeof value === 'object' ? value : {}
  return {
    contact: uniqueStrings(facts.contact),
    businessHours: uniqueStrings(facts.businessHours),
    location: uniqueStrings(facts.location),
  }
}

const normalizeConversationStatePolicy = (value = null) => {
  const policy = value && typeof value === 'object' ? value : {}
  const rawSlotAliases =
    policy.slotAliases && typeof policy.slotAliases === 'object'
      ? policy.slotAliases
      : {}

  const slotAliases = Object.fromEntries(
    Object.entries(rawSlotAliases)
      .filter(
        ([field, slotKey]) =>
          typeof field === 'string' &&
          field.trim() &&
          typeof slotKey === 'string' &&
          slotKey.trim(),
      )
      .map(([field, slotKey]) => [field.trim(), slotKey.trim()]),
  )

  return {
    slotAliases,
    tenantSlots: uniqueStrings(policy.tenantSlots),
  }
}

const buildCatalogTerms = (catalog = [], quoteProfiles = [], staticVocabulary = {}) => {
  const taxonomyItems = normalizeTenantTopicTaxonomy(catalog)
  const taxonomyTerms = taxonomyItems.flatMap((entry) => [
    entry.label,
    ...(Array.isArray(entry.aliases) ? entry.aliases : []),
    ...(Array.isArray(entry.parentLabels) ? entry.parentLabels : []),
    ...(Array.isArray(entry.tags) ? entry.tags : []),
    entry.familyLabel,
  ])
  const quoteProfileTerms = (Array.isArray(quoteProfiles) ? quoteProfiles : []).flatMap(
    (profile) => [
      profile?.label,
      profile?.familyLabel,
      ...(Array.isArray(profile?.appliesToTopicLabels)
        ? profile.appliesToTopicLabels
        : []),
      ...(Array.isArray(profile?.measurementCarrierTerms)
        ? profile.measurementCarrierTerms
        : []),
    ],
  )

  return uniqueStrings([
    ...taxonomyTerms,
    ...quoteProfileTerms,
    ...(Array.isArray(staticVocabulary?.catalogSignalTerms)
      ? staticVocabulary.catalogSignalTerms
      : []),
  ])
}

const pickStaticVocabularyTerms = (staticVocabulary = {}, key) =>
  uniqueStrings(
    Array.isArray(staticVocabulary?.[key]) ? staticVocabulary[key] : [],
  )

const buildQuoteItemTerms = (catalog = [], staticVocabulary = {}) =>
  uniqueStrings([
    ...normalizeTenantTopicTaxonomy(catalog).flatMap((entry) => [
      entry.label,
      ...(Array.isArray(entry.aliases) ? entry.aliases : []),
      entry.familyLabel,
    ]),
    ...pickStaticVocabularyTerms(staticVocabulary, 'quoteItemTerms'),
  ])

const buildProductContextTerms = (catalog = [], quoteProfiles = [], staticVocabulary = {}) =>
  uniqueStrings([
    ...buildCatalogTerms(catalog, quoteProfiles, staticVocabulary),
    ...pickStaticVocabularyTerms(staticVocabulary, 'productContextTerms'),
  ])

const buildProductTypes = (catalog = []) =>
  normalizeTenantTopicTaxonomy(catalog).filter((entry) =>
    ['product_family', 'product_topic', 'product_variant'].includes(entry.kind),
  )

export const buildTenantRuntimePolicy = ({
  tenantKey = 'default',
  topicTaxonomy = [],
  quoteProfiles = [],
} = {}) => {
  const staticPolicy = getStaticTenantPolicy(tenantKey)
  const staticVocabulary = getStaticTenantVocabulary(tenantKey)
  const staticBusinessRules = getStaticTenantBusinessRules(tenantKey)
  const staticConversationStatePolicy = getStaticTenantConversationStatePolicy(tenantKey)
  const catalog = normalizeTenantTopicTaxonomy(topicTaxonomy)
  const productTypes = buildProductTypes(topicTaxonomy)
  const catalogTerms = buildCatalogTerms(topicTaxonomy, quoteProfiles, staticVocabulary)

  return {
    tenantKey,
    staticPolicy,
    catalog,
    quoteProfiles: Array.isArray(quoteProfiles) ? quoteProfiles : [],
    productTypes,
    businessRules: {
      paymentMethods: uniqueStrings(staticBusinessRules?.paymentMethods),
      installationTerms: uniqueStrings(staticBusinessRules?.installationTerms),
      lightFilterComparableFamilies: uniqueStrings(
        staticBusinessRules?.lightFilterComparableFamilies,
      ),
      lightFilterGuidance: normalizeLightFilterGuidance(
        staticBusinessRules?.lightFilterGuidance,
      ),
    },
    businessFacts: normalizeBusinessFacts(staticPolicy?.businessFacts),
    conversationState: normalizeConversationStatePolicy(
      staticConversationStatePolicy,
    ),
    vocabulary: {
      fragmentDescriptors: uniqueStrings(staticVocabulary?.fragmentDescriptors),
      brandTokens: uniqueStrings(staticVocabulary?.brandTokens),
      catalogTerms,
      quoteItemTerms: buildQuoteItemTerms(topicTaxonomy, staticVocabulary),
      productContextTerms: buildProductContextTerms(
        topicTaxonomy,
        quoteProfiles,
        staticVocabulary,
      ),
      supportComponentTerms: pickStaticVocabularyTerms(
        staticVocabulary,
        'supportComponentTerms',
      ),
      catalogCarrierTerms: pickStaticVocabularyTerms(
        staticVocabulary,
        'catalogCarrierTerms',
      ),
      catalogStructuralTerms: pickStaticVocabularyTerms(
        staticVocabulary,
        'catalogStructuralTerms',
      ),
      catalogStructuralPhrases: pickStaticVocabularyTerms(
        staticVocabulary,
        'catalogStructuralPhrases',
      ),
      topicResolutionFillerTerms: pickStaticVocabularyTerms(
        staticVocabulary,
        'topicResolutionFillerTerms',
      ),
      variantContextTerms: pickStaticVocabularyTerms(
        staticVocabulary,
        'variantContextTerms',
      ),
      genericCustomerSignalTerms: pickStaticVocabularyTerms(
        staticVocabulary,
        'genericCustomerSignalTerms',
      ),
      faqSignals: normalizeFaqSignals(staticVocabulary?.faqSignals),
      quoteAttributeFollowUpHints: normalizeQuoteAttributeFollowUpHints(
        staticVocabulary?.quoteAttributeFollowUpHints,
      ),
      knowledgeStatementPrefixes: normalizeKnowledgeStatementPrefixes(
        staticVocabulary?.knowledgeStatementPrefixes,
      ),
      catalogFamilyLabel: normalizeRuleText(staticVocabulary?.catalogFamilyLabel),
    },
  }
}

export const getProductCatalog = (policy = null) =>
  Array.isArray(policy?.catalog) ? policy.catalog : []

export const getProductTypes = (policy = null) =>
  Array.isArray(policy?.productTypes) ? policy.productTypes : []

export const getQuoteRequirements = (policy = null, productType = null) => {
  const normalizedTarget = normalizeText(productType)
  const profiles = Array.isArray(policy?.quoteProfiles) ? policy.quoteProfiles : []
  if (!normalizedTarget) {
    return []
  }

  return profiles.filter((profile) => {
    const labels = uniqueStrings([
      profile?.key,
      profile?.label,
      profile?.familyLabel,
      ...(Array.isArray(profile?.appliesToTopicLabels)
        ? profile.appliesToTopicLabels
        : []),
      ...(Array.isArray(profile?.appliesToTopicKeys)
        ? profile.appliesToTopicKeys
        : []),
    ]).map(normalizeText)

    return labels.includes(normalizedTarget)
  })
}

export const getBusinessRules = (policy = null) => policy?.businessRules ?? {}

export const getBusinessFacts = (policy = null) => policy?.businessFacts ?? {}

export const getConversationStatePolicy = (policy = null) =>
  policy?.conversationState ?? { slotAliases: {}, tenantSlots: [] }

export const getVocabulary = (policy = null) => policy?.vocabulary ?? {}

export const hasCatalogVocabularySignal = (value, policy = null) => {
  const normalizedInput = normalizeText(value)
  if (!normalizedInput) {
    return false
  }

  const terms = getVocabulary(policy)?.catalogTerms ?? []
  return terms.some((entry) => {
    const normalizedTerm = normalizeText(entry)
    return normalizedTerm && normalizedInput.includes(normalizedTerm)
  })
}

export const findBestPolicyTopicMatch = (value, policy = null) =>
  findBestTenantTopicMatch(value, getProductCatalog(policy))

export const matchesBusinessRuleValue = (value, acceptedValues = []) => {
  const normalizedInput = normalizeText(value)
  if (!normalizedInput) {
    return false
  }

  return uniqueStrings(acceptedValues).some((entry) => {
    const normalizedEntry = normalizeText(entry)
    return normalizedEntry && normalizedInput.includes(normalizedEntry)
  })
}
