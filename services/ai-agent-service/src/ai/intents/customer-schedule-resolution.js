import { pickWordingVariant } from '../outcomes/wording-registry.js'
import { localePrefersEnglish, normalizeChatLocale } from '../locale-format.js'

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeText = (value) =>
  compactText(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' '),
  )

const buildDayWindow = (dateValue) => {
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue || '')
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
  }
}

const parseIsoDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const buildCustomerScheduleSearchWindow = (scheduleContext = null) => {
  const scheduleDate =
    scheduleContext?.date?.date instanceof Date ? scheduleContext.date.date : null
  if (!scheduleDate) {
    return null
  }
  return buildDayWindow(scheduleDate)
}

export const findCustomerScheduleOverlap = (scheduleContext = null, appointments = []) => {
  const requestedStart = parseIsoDate(scheduleContext?.startAt)
  if (!requestedStart) {
    return null
  }

  const requestedEnd =
    parseIsoDate(scheduleContext?.endAt) ||
    new Date(requestedStart.getTime() + 60 * 60_000)

  for (const appointment of Array.isArray(appointments) ? appointments : []) {
    const appointmentStart = parseIsoDate(appointment?.startAt)
    if (!appointmentStart) {
      continue
    }
    const appointmentEnd =
      parseIsoDate(appointment?.endAt) ||
      new Date(appointmentStart.getTime() + 60 * 60_000)
    if (appointmentStart < requestedEnd && appointmentEnd > requestedStart) {
      return appointment
    }
  }

  return null
}

export const buildCustomerScheduleConfirmationClarifyText = ({
  intentKey = null,
  scheduleContext = null,
  variationSeed = '',
  wordingOverrides = null,
  locale = 'es-UY',
}) => {
  if (intentKey !== 'customer.confirmation') {
    return null
  }

  const missingFields = Array.isArray(scheduleContext?.missingFields)
    ? scheduleContext.missingFields.filter((entry) => typeof entry === 'string')
    : []
  if (!missingFields.length) {
    return null
  }

  const hasDate = Boolean(scheduleContext?.date?.dateLabel)
  const hasTime = Boolean(scheduleContext?.time?.timeLabel)
  const hasAddress =
    typeof scheduleContext?.address === 'string' && scheduleContext.address.trim().length > 0

  const normalizedLocale = normalizeChatLocale(locale)
  const prefersEnglish = localePrefersEnglish(normalizedLocale)

  if (hasDate && !hasTime) {
    return pickWordingVariant({
      key: 'customer.schedule.confirmation.day_known',
      variationSeed,
      overrides: wordingOverrides,
      fallback: prefersEnglish
        ? 'Perfect. I already have the day. Do you want to tell me a specific time or would you prefer me to suggest one?'
        : 'Perfecto. Ya tengo el día. ¿Querés decirme un horario concreto o preferís que te proponga uno?',
    })
  }
  if (!hasDate && hasTime) {
    return pickWordingVariant({
      key: 'customer.schedule.confirmation.time_known',
      variationSeed,
      overrides: wordingOverrides,
      fallback: prefersEnglish
        ? 'Perfect. I already have the reference time. What day would work for the visit?'
        : 'Perfecto. Ya tengo el horario de referencia. ¿Qué día te vendría bien para la visita?',
    })
  }
  if (hasDate && hasTime && !hasAddress) {
    return pickWordingVariant({
      key: 'customer.schedule.confirmation.address_missing',
      variationSeed,
      overrides: wordingOverrides,
      fallback: prefersEnglish
        ? 'Perfect. I already have the day and time. Send me the address where we would need to go and I will finish coordinating it.'
        : 'Perfecto. Ya tengo el día y el horario. Pasame la dirección donde habría que ir y lo termino de coordinar.',
    })
  }

  return pickWordingVariant({
    key: 'customer.schedule.confirmation.full_missing',
    variationSeed,
    overrides: wordingOverrides,
    fallback: prefersEnglish
      ? 'Perfect. To continue with the visit, I need you to confirm the day, time, address, and a contact phone number or email.'
      : 'Perfecto. Para seguir con la visita, necesito que me confirmes el día, el horario, la dirección y un teléfono o email de contacto.',
  })
}

export const buildCustomerScheduleCancellationText = (
  scheduleContext = null,
  options = {},
) => {
  const locale = normalizeChatLocale(options?.locale)
  const prefersEnglish = localePrefersEnglish(locale)
  const reason =
    typeof scheduleContext?.reason === 'string' && scheduleContext.reason.trim()
      ? scheduleContext.reason.trim()
      : 'la visita técnica'
  return prefersEnglish
    ? `Perfect. We will leave ${reason} unscheduled for now. If you want to resume it later, we can continue here.`
    : `Perfecto. Dejamos sin coordinar ${reason} por ahora. Si querés retomarlo más adelante, seguimos por acá.`
}

export const buildCustomerScheduleAppointmentPayload = ({
  scheduleContext = null,
  conversationId = null,
  customerId = null,
}) => {
  if (!scheduleContext || typeof scheduleContext !== 'object') {
    return null
  }

  const descriptionLines = [
    scheduleContext.purpose
      ? `Motivo: ${compactText(scheduleContext.purpose)}`
      : scheduleContext.reason
        ? `Motivo: ${compactText(scheduleContext.reason)}`
        : null,
    scheduleContext.contactName
      ? `Contacto: ${compactText(scheduleContext.contactName)}`
      : null,
    scheduleContext.contactPhone
      ? `Teléfono: ${compactText(scheduleContext.contactPhone)}`
      : null,
    scheduleContext.contactEmail
      ? `Email: ${compactText(scheduleContext.contactEmail)}`
      : null,
    conversationId ? `Conversación: ${compactText(conversationId)}` : null,
  ].filter(Boolean)

  return {
    title:
      typeof scheduleContext.title === 'string' && scheduleContext.title.trim()
        ? scheduleContext.title.trim()
        : 'Visita técnica',
    description: descriptionLines.join('\n') || undefined,
    startAt: scheduleContext.startAt,
    endAt: scheduleContext.endAt || undefined,
    type: 'MEETING',
    location:
      typeof scheduleContext.address === 'string' && scheduleContext.address.trim()
        ? scheduleContext.address.trim()
        : undefined,
    customerId:
      Number.isInteger(Number(customerId)) && Number(customerId) > 0
        ? Number(customerId)
        : undefined,
    metadata: {
      scheduleKind: 'customer_technical_visit',
      reason:
        typeof scheduleContext.reason === 'string' ? scheduleContext.reason : null,
      purpose:
        typeof scheduleContext.purpose === 'string'
          ? scheduleContext.purpose
          : null,
      contactName:
        typeof scheduleContext.contactName === 'string'
          ? scheduleContext.contactName
          : null,
      contactPhone:
        typeof scheduleContext.contactPhone === 'string'
          ? scheduleContext.contactPhone
          : null,
      contactEmail:
        typeof scheduleContext.contactEmail === 'string'
          ? scheduleContext.contactEmail
          : null,
      conversationId: conversationId || null,
      source: 'customer_runtime_schedule',
    },
  }
}

export const looksLikeScheduleWaitingFollowUp = (input) =>
  /\b(quedo agendad[ao]|quedo coordinad[ao]|queda coordinad[ao]|revisaste la disponibilidad|pudiste agendar|espero la visita)\b/i.test(
    String(input || ''),
  )

export const normalizeScheduleReason = (scheduleContext = null) =>
  normalizeText(scheduleContext?.purpose || scheduleContext?.reason || '')
