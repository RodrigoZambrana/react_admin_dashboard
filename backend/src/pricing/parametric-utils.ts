import { Prisma } from '@prisma/client'
import { decimal } from '../common/currency/money.util'

export const DEFAULT_PARAMETRIC_SCHEMA = {
  inputs: {
    width: {
      type: 'decimal',
      label: 'Ancho',
      min: 0.3,
      max: 6,
      step: 0.01,
      unit: 'm',
    },
    height: {
      type: 'decimal',
      label: 'Alto',
      min: 0.3,
      max: 6,
      step: 0.01,
      unit: 'm',
    },
    series: {
      type: 'select',
      label: 'Serie',
      options: ['20', '25', '30', 'GALA', 'PROBBA', 'SUMMA'],
    },
    color: {
      type: 'select',
      label: 'Color',
      options: ['NATURAL', 'WHITE', 'BLACK', 'BROWN', 'ANOLOC'],
      default: 'NATURAL',
    },
    glass: {
      type: 'select',
      label: 'Vidrio',
      options: ['3MM', '4MM', '5MM', '6MM', 'DVH'],
      default: '4MM',
    },
    mosquitoNet: {
      type: 'boolean',
      label: 'Mosquitero',
      default: false,
    },
    monoblock: {
      type: 'group',
      label: 'Monoblock',
      fields: {
        enabled: { type: 'boolean', label: 'Agregar monoblock', default: false },
        material: { type: 'select', label: 'Material', options: ['PVC', 'ALUMINUM'], default: 'PVC' },
        color: { type: 'select', label: 'Color', options: ['WHITE', 'NATURAL', 'BLACK', 'BROWN'], default: 'WHITE' },
      },
    },
  },
  presets: [],
}

export const sanitizeDecimalInput = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const normalized = trimmed.replace(',', '.')
    const num = Number(normalized)
    if (!Number.isFinite(num)) {
      return null
    }
    return normalized
  }
  return null
}

const normalizeText = (input: unknown): string => {
  if (input === null || input === undefined) return ''
  return String(input)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export const normalizeSeries = (input: unknown): string => {
  const text = normalizeText(input)
  if (!text) return '20'
  if (/GALA/.test(text)) return 'GALA'
  if (/PROBBA/.test(text)) return 'PROBBA'
  if (/SUMMA/.test(text)) return 'SUMMA'
  if (text === '30' || text === 'S30') return '30'
  if (text === '25' || text === 'S25') return '25'
  if (text === '20' || text === 'S20') return '20'
  return text
}

export const normalizeColor = (input: unknown): string => {
  const text = normalizeText(input)
  if (!text) return 'NATURAL'
  if (text.includes('NAT') || text === 'ANODIZADO' || text === 'ANODIZADO NATURAL') return 'NATURAL'
  if (text.includes('WHITE') || text.includes('BLANCO')) return 'WHITE'
  if (text.includes('BLACK') || text.includes('NEGRO')) return 'BLACK'
  if (text.includes('BROWN') || text.includes('MARRON')) return 'BROWN'
  if (text.includes('ANOLOC')) return 'ANOLOC'
  return text
}

export const normalizeGlass = (input: unknown): string => {
  const text = normalizeText(input)
  if (!text) return '4MM'
  if (text.includes('DVH')) return 'DVH'
  if (text.includes('6')) return '6MM'
  if (text.includes('5')) return '5MM'
  if (text.includes('4')) return '4MM'
  if (text.includes('3')) return '3MM'
  return text
}

export const normalizeYesNo = (input: unknown): boolean => {
  const text = normalizeText(input)
  if (!text) return false
  if (['SI', 'SÍ', 'YES', 'Y', 'TRUE', '1'].includes(text)) return true
  if (['NO', 'N', 'FALSE', '0'].includes(text)) return false
  return false
}

export const toNumber = (value: unknown, scale = 4): number => {
  let normalized: Prisma.Decimal.Value | null = null
  if (typeof value === 'number' || typeof value === 'string') {
    normalized = value
  } else if (value instanceof Prisma.Decimal) {
    normalized = value
  }
  return Number(decimal(normalized ?? 0).toFixed(scale))
}
