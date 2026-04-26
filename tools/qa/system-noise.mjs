const normalizeNoiseText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const SYSTEM_NOISE_EXACT_MESSAGES = new Set([
  'esperando mensaje',
  'esperando este mensaje',
  'esperando el mensaje',
  'aguardando mensaje',
  'aguardando este mensaje',
  'aguardando el mensaje',
])

export const SYSTEM_NOISE_IGNORE_REASON = 'whatsapp_export_noise'

export const isSystemNoiseMessage = (input) =>
  SYSTEM_NOISE_EXACT_MESSAGES.has(normalizeNoiseText(input))
