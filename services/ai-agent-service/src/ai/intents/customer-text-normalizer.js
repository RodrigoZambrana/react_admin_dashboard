import { buildTenantTopicNormalizationRules } from './customer-topic-taxonomy.js'

const normalizeBaseText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const NORMALIZATION_RULES = [
  {
    key: 'glued_greeting_morning',
    pattern: /\bbuenosdias\b/g,
    replacement: 'buenos dias',
  },
  {
    key: 'glued_greeting_afternoon',
    pattern: /\bbuenastardes\b/g,
    replacement: 'buenas tardes',
  },
  {
    key: 'glued_greeting_night',
    pattern: /\bbuenasnoches\b/g,
    replacement: 'buenas noches',
  },
  {
    key: 'glued_payment_methods',
    pattern: /\bmediosdepago\b/g,
    replacement: 'medios de pago',
  },
  {
    key: 'plural_payment_methods',
    pattern: /\bmedios de pagos\b/g,
    replacement: 'medios de pago',
  },
  {
    key: 'glued_payment_forms',
    pattern: /\bformasdepago\b/g,
    replacement: 'formas de pago',
  },
  {
    key: 'plural_payment_forms',
    pattern: /\bformas de pagos\b/g,
    replacement: 'formas de pago',
  },
  {
    key: 'glued_location',
    pattern: /\bdondeestan\b/g,
    replacement: 'donde estan',
  },
  {
    key: 'glued_consulting',
    pattern: /\bconsultarpor\b/g,
    replacement: 'consultar por',
  },
  {
    key: 'glued_consulting_about',
    pattern: /\bconsultarsobre\b/g,
    replacement: 'consultar sobre',
  },
  {
    key: 'glued_need_information',
    pattern: /\bnecesitoinformacion\b/g,
    replacement: 'necesito informacion',
  },
  {
    key: 'glued_want_information',
    pattern: /\bquieroinformacion\b/g,
    replacement: 'quiero informacion',
  },
  {
    key: 'glued_want_to_know',
    pattern: /\bquierosaber\b/g,
    replacement: 'quiero saber',
  },
  {
    key: 'abbreviation_info',
    pattern: /\binfo\b/g,
    replacement: 'informacion',
  },
  {
    key: 'abbreviation_transfer',
    pattern: /\btransf\b/g,
    replacement: 'transferencia',
  },
  {
    key: 'abbreviation_card',
    pattern: /\btc\b/g,
    replacement: 'tarjeta',
  },
  {
    key: 'typo_need_information',
    pattern: /\bnecsto\b|\bnecisito\b|\bnesecito\b|\bnesesito\b/g,
    replacement: 'necesito',
  },
  {
    key: 'typo_information',
    pattern: /\binformnacion\b|\binfrmacion\b|\binfoormacion\b/g,
    replacement: 'informacion',
  },
  {
    key: 'typo_schedule',
    pattern: /\borairo\b|\bhoraro\b|\bhorairo\b/g,
    replacement: 'horario',
  },
  {
    key: 'typo_location',
    pattern: /\bubicaion\b|\bubiacion\b/g,
    replacement: 'ubicacion',
  },
  {
    key: 'typo_transfer',
    pattern: /\btranferencia\b|\btranferecia\b|\btranferncia\b/g,
    replacement: 'transferencia',
  },
  {
    key: 'typo_know',
    pattern: /\bsaver\b/g,
    replacement: 'saber',
  },
  {
    key: 'typo_today',
    pattern: /\boy\b/g,
    replacement: 'hoy',
  },
  {
    key: 'variant_good_day',
    pattern: /\bbuen dia\b/g,
    replacement: 'buenos dias',
  },
]

const applyNormalizationRule = (input, rule) => {
  const matches = input.match(rule.pattern)
  if (!matches?.length) {
    return null
  }

  return {
    value: input.replace(rule.pattern, rule.replacement).replace(/\s+/g, ' ').trim(),
    operation: {
      key: rule.key,
      replacements: Array.from(new Set(matches.map((match) => String(match).trim()))),
      replacement: rule.replacement,
    },
  }
}

const shouldSkipTopicNormalization = (input, rule, offset) => {
  if (rule.kind !== 'product_topic' || !rule.familyLabel) {
    return false
  }

  const familyLabel = normalizeBaseText(rule.familyLabel)
  if (!familyLabel) {
    return false
  }

  const prefix = normalizeBaseText(input.slice(Math.max(0, offset - 48), offset))
  return prefix.includes(familyLabel)
}

const applyTenantTopicNormalizationRule = (input, rule) => {
  const replacements = []
  const value = input
    .replace(rule.pattern, (match, ...args) => {
      const offset = args.at(-2)
      const fullInput = args.at(-1)
      if (
        typeof offset === 'number' &&
        typeof fullInput === 'string' &&
        shouldSkipTopicNormalization(fullInput, rule, offset)
      ) {
        return match
      }

      replacements.push(String(match).trim())
      return rule.replacement
    })
    .replace(/\s+/g, ' ')
    .trim()

  if (!replacements.length) {
    return null
  }

  return {
    value,
    operation: {
      key: `taxonomy_alias:${rule.key}`,
      replacements: Array.from(new Set(replacements)),
      replacement: rule.replacement,
    },
  }
}

export const normalizeCustomerTextForIntent = (input, options = {}) => {
  const baselineInput = normalizeBaseText(input)
  if (!baselineInput) {
    return {
      originalInput: String(input || ''),
      baselineInput,
      normalizedInput: baselineInput,
      changed: false,
      operations: [],
    }
  }

  let normalizedInput = baselineInput
  const operations = []

  for (const rule of NORMALIZATION_RULES) {
    const result = applyNormalizationRule(normalizedInput, rule)
    if (!result) {
      continue
    }

    normalizedInput = result.value
    operations.push(result.operation)
  }

  for (const rule of buildTenantTopicNormalizationRules(
    options?.tenantTopicTaxonomy ?? [],
  )) {
    const result = applyTenantTopicNormalizationRule(normalizedInput, rule)
    if (!result) {
      continue
    }

    normalizedInput = result.value
    operations.push(result.operation)
  }

  return {
    originalInput: String(input || ''),
    baselineInput,
    normalizedInput,
    changed: operations.length > 0,
    operations,
  }
}
