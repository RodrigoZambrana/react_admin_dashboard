const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeText = (value) =>
  compactText(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s:/-]+/g, ' '),
  )

const WEEKDAY_INDEX = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
}

const CONTACT_NAME_PATTERNS = [
  /\b(?:mi nombre es|me llamo|soy)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/iu,
]

const ADDRESS_PATTERNS = [
  /\b(?:direccion|dirección|ubicacion|ubicación)\s*:?\s+(.+)$/iu,
  /\b(?:en|para)\s+([a-záéíóúñ0-9 .,'/-]{8,})$/iu,
]

const DAY_TIME_PATTERNS = [
  /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/,
  /\b(hoy|mañana|pasado mañana|pasadomañana|pasadomanana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/iu,
]

const TIME_PATTERNS = [
  /\b(?:a\s+las|a\s+la|tipo|hora|horario)\s+(\d{1,2})(?::(\d{2}))?\b/iu,
  /\b(\d{1,2}):(\d{2})\b/,
]

const TIME_PREFERENCE_PATTERNS = [
  /\b(?:despues|después)\s+de\s+las\s+(\d{1,2})(?::(\d{2}))?\b/iu,
  /\b(por\s+la\s+mañana|por\s+la\s+tarde|por\s+la\s+noche)\b/iu,
]

const PHONE_FALLBACK_REGEX = /\b(?:\+?\d[\d\s-]{6,}\d)\b/u

const DEFAULT_DURATION_MINUTES = 60

const looksLikeScheduleAdministrativeFollowUp = (input) =>
  /\b(hoy|mañana|pasado mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|\d{1,2}\/\d{1,2}(?:\/\d{4})?|a las|hora|horario|despues de las|después de las|por la mañana|por la tarde|por la noche|direccion|dirección|ubicacion|ubicación|avenida|av\.|calle|ruta|telefono|teléfono|celular|whatsapp|mail|email|correo)\b/iu.test(
    String(input || ''),
  )

const looksLikeAddressValue = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return (
    /\b(avenida|av|av\.|calle|ruta|camino|bulevar|blvr|esquina|esq|km|kilometro|kilómetro|manzana|solar|apto|apartamento|local)\b/iu.test(
      normalized,
    ) || /\d/.test(normalized)
  )
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const buildLocalIso = ({ year, month, day, hour, minute = 0 }) => {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const formatDateLabel = (date) =>
  new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)

const formatTimeLabel = (hour, minute = 0) =>
  new Intl.NumberFormat('es-UY', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(hour) +
  ':' +
  new Intl.NumberFormat('es-UY', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(minute)

const extractPhone = (nluAnalysis = null) => {
  const firstPhone = Array.isArray(nluAnalysis?.entities?.phones)
    ? nluAnalysis.entities.phones[0]
    : Array.isArray(nluAnalysis?.phones)
      ? nluAnalysis.phones[0]
      : null
  const value =
    firstPhone?.resolution?.[0]?.value || firstPhone?.text || firstPhone?.value || null
  return typeof value === 'string' && value.trim() ? compactText(value) : null
}

const extractPhoneFromText = (input) => {
  const match = String(input || '').match(PHONE_FALLBACK_REGEX)
  if (!match?.[0]) {
    return null
  }
  return compactText(match[0])
}

const extractEmail = (nluAnalysis = null) => {
  const firstEmail = Array.isArray(nluAnalysis?.entities?.emails)
    ? nluAnalysis.entities.emails[0]
    : Array.isArray(nluAnalysis?.emails)
      ? nluAnalysis.emails[0]
      : null
  const value = firstEmail?.value || firstEmail?.text || null
  return typeof value === 'string' && value.trim() ? compactText(value) : null
}

const extractContactName = (input) => {
  for (const pattern of CONTACT_NAME_PATTERNS) {
    const match = String(input || '').match(pattern)
    if (match?.[1]) {
      return compactText(match[1])
    }
  }
  return null
}

const sanitizeAddressValue = (value) => {
  const sanitized = compactText(
    String(value || '')
      .split(
        /\b(?:mi\s+telefono|mi\s+tel[eé]fono|telefono|tel[eé]fono|celular|whatsapp|mail|email|correo|a\s+las|hora|horario|despues\s+de\s+las|después\s+de\s+las|por\s+la\s+mañana|por\s+la\s+tarde|por\s+la\s+noche|estoy\s+en\s+casa|estare|estar[eé])\b/iu,
      )[0]
      .replace(/[,\s.;:]+$/g, ''),
  )

  return sanitized || null
}

const extractAddress = (input) => {
  for (const pattern of ADDRESS_PATTERNS) {
    const match = String(input || '').match(pattern)
    if (match?.[1]) {
      const value = sanitizeAddressValue(match[1])
      if (value.length >= 8 && looksLikeAddressValue(value)) {
        return value
      }
    }
  }

  const residualCandidate = sanitizeAddressValue(
    compactText(
      String(input || '')
        .replace(PHONE_FALLBACK_REGEX, ' ')
        .replace(
          /\b(?:mi nombre es|me llamo|soy|mi telefono es|mi teléfono es|telefono|teléfono|celular|whatsapp|mail|email|correo|puedo|seria|sería|preferiria|preferiría|me sirve|me queda bien)\b.*$/iu,
          ' ',
        )
        .replace(
          /\b(?:hoy|mañana|pasado mañana|pasadomañana|pasadomanana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b.*$/iu,
          ' ',
        )
        .replace(/\b(?:a\s+las|hora|horario|tipo)\s+\d{1,2}(?::\d{2})?\b/iu, ' ')
        .replace(/[.,;:]+$/g, ''),
    ),
  )
  if (
    residualCandidate &&
    residualCandidate.length >= 8 &&
    looksLikeAddressValue(residualCandidate)
  ) {
    return residualCandidate
  }
  return null
}

const resolveRelativeDay = (token, now = new Date()) => {
  const normalized = normalizeText(token)
  if (!normalized) {
    return null
  }

  if (normalized === 'hoy') {
    return new Date(now)
  }
  if (normalized === 'manana' || normalized === 'mañana') {
    return addDays(now, 1)
  }
  if (
    normalized === 'pasado manana' ||
    normalized === 'pasado mañana' ||
    normalized === 'pasadomanana' ||
    normalized === 'pasadomañana'
  ) {
    return addDays(now, 2)
  }

  if (Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, normalized)) {
    const targetDay = WEEKDAY_INDEX[normalized]
    const currentDay = now.getDay()
    const delta = (targetDay - currentDay + 7) % 7 || 7
    return addDays(now, delta)
  }

  return null
}

const extractRequestedDate = (input, now = new Date()) => {
  const source = String(input || '')
  const explicitMatch = source.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/)
  if (explicitMatch) {
    const day = Number(explicitMatch[1])
    const month = Number(explicitMatch[2])
    const year = explicitMatch[3] ? Number(explicitMatch[3]) : now.getFullYear()
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const date = new Date(year, month - 1, day)
      if (!Number.isNaN(date.getTime())) {
        return {
          date,
          dateLabel: formatDateLabel(date),
          exact: true,
          source: 'explicit_date',
        }
      }
    }
  }

  const relativeMatch = source.match(
    /\b(hoy|mañana|pasado mañana|pasadomañana|pasadomanana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/iu,
  )
  if (relativeMatch?.[1]) {
    const date = resolveRelativeDay(relativeMatch[1], now)
    if (date) {
      return {
        date,
        dateLabel:
          relativeMatch[1].toLowerCase() === 'hoy' ||
          normalizeText(relativeMatch[1]) === 'manana' ||
          normalizeText(relativeMatch[1]).includes('pasado')
            ? compactText(relativeMatch[1])
            : `${compactText(relativeMatch[1])} ${formatDateLabel(date)}`,
        exact: true,
        source: 'relative_date',
      }
    }
  }

  return null
}

const extractRequestedTime = (input) => {
  const source = String(input || '')
  for (const pattern of TIME_PATTERNS) {
    const match = source.match(pattern)
    if (match?.[1]) {
      const hour = Number(match[1])
      const minute = match[2] ? Number(match[2]) : 0
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return {
          hour,
          minute,
          timeLabel: formatTimeLabel(hour, minute),
          exact: true,
          source: 'explicit_time',
        }
      }
    }
  }

  const preferenceMatch = source.match(TIME_PREFERENCE_PATTERNS[0])
  if (preferenceMatch?.[1]) {
    const hour = Number(preferenceMatch[1])
    const minute = preferenceMatch[2] ? Number(preferenceMatch[2]) : 0
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return {
        hour,
        minute,
        timeLabel: `después de las ${formatTimeLabel(hour, minute)}`,
        exact: false,
        source: 'time_preference_after',
      }
    }
  }

  const periodMatch = source.match(TIME_PREFERENCE_PATTERNS[1])
  if (periodMatch?.[1]) {
    return {
      hour: null,
      minute: null,
      timeLabel: compactText(periodMatch[1]),
      exact: false,
      source: 'time_period',
    }
  }

  return null
}

const inferScheduleReason = ({
  currentTurnText,
  previousScheduleContext = null,
  previousQuoteContext = null,
  currentTopic = null,
}) => {
  const normalizedInput = normalizeText(currentTurnText)

  if (
    looksLikeScheduleAdministrativeFollowUp(currentTurnText) &&
    typeof previousScheduleContext?.reason === 'string' &&
    previousScheduleContext.reason.trim()
  ) {
    return previousScheduleContext.reason.trim()
  }

  if (/\binstalacion|instalación|colocacion|colocación\b/.test(normalizedInput)) {
    return 'instalación'
  }
  if (/\bvisita\b/.test(normalizedInput)) {
    return 'visita técnica'
  }

  return previousScheduleContext?.reason || 'visita técnica'
}

const inferSchedulePurpose = ({
  currentTurnText,
  previousScheduleContext = null,
  previousQuoteContext = null,
  currentTopic = null,
}) => {
  if (
    looksLikeScheduleAdministrativeFollowUp(currentTurnText) &&
    typeof previousScheduleContext?.purpose === 'string' &&
    previousScheduleContext.purpose.trim()
  ) {
    return previousScheduleContext.purpose.trim()
  }

  const topicLabel =
    compactText(currentTopic?.label || '') ||
    compactText(previousQuoteContext?.topicLabel || '') ||
    compactText(previousQuoteContext?.familyLabel || '')

  if (topicLabel) {
    return `cotizar ${topicLabel}`
  }

  if (
    typeof previousScheduleContext?.purpose === 'string' &&
    previousScheduleContext.purpose.trim()
  ) {
    return previousScheduleContext.purpose.trim()
  }

  return inferScheduleReason({
    currentTurnText,
    previousScheduleContext,
    previousQuoteContext,
    currentTopic,
  })
}

const buildScheduleTitle = (reason) => {
  const cleanReason = compactText(reason)
  if (!cleanReason || normalizeText(cleanReason) === 'visita tecnica') {
    return 'Visita técnica'
  }
  return cleanReason ? `Visita técnica · ${cleanReason}` : 'Visita técnica'
}

export const buildCustomerScheduleContext = ({
  currentTurnText,
  previousScheduleContext = null,
  previousQuoteContext = null,
  currentTopic = null,
  nluAnalysis = null,
  now = new Date(),
}) => {
  const previous =
    previousScheduleContext && typeof previousScheduleContext === 'object'
      ? previousScheduleContext
      : null
  const date = extractRequestedDate(currentTurnText, now) || previous?.date || null
  const time = extractRequestedTime(currentTurnText) || previous?.time || null
  const address = sanitizeAddressValue(extractAddress(currentTurnText) || previous?.address || null)
  const contactPhone =
    extractPhone(nluAnalysis) ||
    extractPhoneFromText(currentTurnText) ||
    previous?.contactPhone ||
    null
  const contactEmail = extractEmail(nluAnalysis) || previous?.contactEmail || null
  const contactName = extractContactName(currentTurnText) || previous?.contactName || null
  const reason =
    inferScheduleReason({
      currentTurnText,
      previousScheduleContext: previous,
      previousQuoteContext,
      currentTopic,
    }) || previous?.reason || 'visita técnica'
  const purpose =
    inferSchedulePurpose({
      currentTurnText,
      previousScheduleContext: previous,
      previousQuoteContext,
      currentTopic,
    }) || previous?.purpose || reason

  const hasExactDate = Boolean(date?.date && date?.exact)
  const hasExactTime = Boolean(time?.exact && Number.isInteger(time?.hour))
  const startAt =
    hasExactDate && hasExactTime
      ? buildLocalIso({
          year: date.date.getFullYear(),
          month: date.date.getMonth() + 1,
          day: date.date.getDate(),
          hour: time.hour,
          minute: time.minute || 0,
        })
      : null
  const endAt =
    startAt && Number.isFinite(DEFAULT_DURATION_MINUTES)
      ? new Date(new Date(startAt).getTime() + DEFAULT_DURATION_MINUTES * 60_000).toISOString()
      : null

  const missingFields = []
  if (!hasExactDate) {
    missingFields.push('day')
  }
  if (!hasExactTime) {
    missingFields.push('time')
  }
  if (!address) {
    missingFields.push('address')
  }
  if (!contactPhone && !contactEmail) {
    missingFields.push('contact')
  }

  return {
    title: buildScheduleTitle(reason),
    reason,
    purpose,
    date,
    time,
    address,
    contactName,
    contactPhone,
    contactEmail,
    startAt,
    endAt,
    missingFields,
    completionStatus: missingFields.length === 0 ? 'ready_to_schedule' : 'needs_info',
  }
}
