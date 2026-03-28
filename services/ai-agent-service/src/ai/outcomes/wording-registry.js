const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const hashSeed = (value) => {
  const source = String(value || '')
  let hash = 0
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0
  }
  return hash
}

const interpolateTemplate = (template, variables = {}) =>
  String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
    compactText(variables[key] ?? ''),
  )

const WORDING_REGISTRY = {
  'customer.faq.product_availability': [
    'Sí, contamos con {topic}. Si quieres, te amplío beneficios, usos y opciones según lo que necesitas.',
    'Sí, trabajamos con {topic}. Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.',
  ],
  'customer.faq.product_general': [
    'Sí, trabajamos con {topic}. Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.',
    'Sí, contamos con {topic}. Si quieres, te amplío beneficios, usos y opciones según lo que necesitas.',
  ],
  'customer.product.info_offer': [
    'Sí, trabajamos con {topic}. Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.',
    'Sí, contamos con {topic}. Si quieres, te amplío beneficios, usos y alternativas según lo que necesitas.',
  ],
  'customer.product.options_offer': [
    'Perfecto, trabajamos con varios tipos de {topic}. ¿Tenés alguno en mente o querés que te cuente opciones?',
    'Claro, manejamos distintas opciones de {topic}. ¿Querés que te muestre alternativas o ya tenés alguna en mente?',
  ],
  'customer.faq.product_general_with_evidence': [
    'Sí, trabajamos con {topic}. {evidence} Si quieres, te cuento opciones y usos según lo que necesitas.',
    'Sí, contamos con {topic}. {evidence} Si quieres, te amplío beneficios y aplicaciones según lo que necesitas.',
  ],
  'customer.faq.product_family_options': [
    'Perfecto, trabajamos con varios tipos de {topic}. ¿Tenés alguno en mente o querés que te cuente opciones?',
    'Claro, manejamos distintas opciones de {topic}. ¿Querés que te muestre alternativas o ya tenés alguna en mente?',
  ],
  'customer.faq.product_variant_with_evidence': [
    'Sí, también tenemos {topic}. {evidence} Si quieres, te cuento cuál conviene más según luz, privacidad y uso.',
    'Sí, trabajamos con {topic}. {evidence} Si quieres, te ayudo a comparar opciones según lo que buscas.',
  ],
  'customer.schedule.confirmation.day_known': [
    'Perfecto. Ya tengo el día. ¿Querés decirme un horario concreto o preferís que te proponga uno?',
    'Bien. El día ya me quedó claro. ¿Te sirve indicarme un horario puntual o preferís que te proponga uno?',
    'Perfecto. El día ya está. Ahora decime un horario concreto o, si querés, te propongo uno.',
  ],
  'customer.schedule.confirmation.time_known': [
    'Perfecto. Ya tengo el horario de referencia. ¿Qué día te vendría bien para la visita?',
    'Bien. El horario ya me quedó claro. Ahora decime qué día te sirve para coordinar la visita.',
    'Perfecto. Tomo ese horario como referencia. ¿Qué día te queda mejor para la visita?',
  ],
  'customer.schedule.confirmation.address_missing': [
    'Perfecto. Ya tengo el día y el horario. Pasame la dirección donde habría que ir y lo termino de coordinar.',
    'Bien. El día y el horario ya me quedaron claros. Ahora pasame la dirección y cierro la coordinación.',
    'Perfecto. Ya tengo cuándo sería. Decime la dirección donde habría que ir y lo dejo listo.',
  ],
  'customer.schedule.confirmation.full_missing': [
    'Perfecto. Para seguir con la visita, necesito que me confirmes el día, el horario, la dirección y un teléfono o email de contacto.',
    'Claro. Para terminar de coordinar la visita, necesito el día, el horario, la dirección y un teléfono o email de contacto.',
  ],
  'customer.schedule.progress.ready': [
    'Perfecto. Ya tengo lo necesario para coordinar {reason}. Estoy validando la disponibilidad y te confirmo el agendamiento.',
    'Bien. Ya quedó completo el intake para coordinar {reason}. Estoy revisando disponibilidad y te confirmo el agendamiento.',
  ],
  'customer.schedule.progress.ask_day': [
    'Perfecto. Para coordinar {reason}, decime qué día te queda bien.',
    'Claro. Para coordinar {reason}, indicame qué día te sirve.',
  ],
  'customer.schedule.progress.ask_time': [
    'Perfecto. Para coordinar {reason}, decime un horario concreto que te sirva.',
    'Claro. Para coordinar {reason}, indicame un horario puntual que te quede bien.',
  ],
  'customer.schedule.progress.ask_address': [
    'Perfecto. Para coordinar {reason}, pasame la dirección donde habría que ir.',
    'Claro. Para coordinar {reason}, decime la dirección donde tendríamos que ir.',
  ],
  'customer.schedule.progress.ask_contact': [
    'Perfecto. Para coordinar {reason}, pasame un teléfono o email de contacto.',
    'Claro. Para coordinar {reason}, decime un teléfono o email de contacto.',
  ],
  'customer.support.followup': [
    'Claro. Si necesitás una revisión o ajuste, contame qué producto es y qué habría que revisar, y coordinamos cómo seguir.',
    'Perfecto. Si se trata de service o postventa, decime qué producto es y qué habría que ajustar, y lo encaminamos.',
  ],
  'customer.schedule.created': [
    'Perfecto. Ya dejé agendada la visita técnica para {timeText}.',
    'Perfecto. La visita técnica ya quedó agendada para {timeText}.',
  ],
  'customer.schedule.unavailable': [
    'En ese momento ya no tengo disponibilidad para {scheduleText}. Si querés, pasame otra opción de día u horario y lo reviso.',
    'Para {scheduleText} ya no tengo disponibilidad. Si querés, pasame otro día u horario y lo reviso.',
  ],
  'customer.quote.waiting_followup': [
    'Perfecto. Quedó en seguimiento. Si hace falta algún dato adicional, te lo piden por aquí.',
    'Perfecto. Ya quedó en seguimiento. Si necesitan algún dato más, te lo piden por acá.',
  ],
  'customer.quote.handoff_ready': [
    'Gracias por la información enviada. Le enviamos la cotización a la brevedad. Si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
    'Perfecto. Ya quedó encaminada la solicitud. Le enviamos la cotización a la brevedad y, si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
  ],
  'customer.fallback.material_followup': [
    'Puedo dejar en seguimiento tu pedido para que un asesor te comparta fotos o material de referencia sobre {subject} por este mismo canal.',
    'Perfecto. Dejo tu consulta en seguimiento para que un asesor te envíe fotos o material de apoyo sobre {subject} por aquí.',
  ],
  'customer.fallback.information_then_handoff': [
    'Puedo orientarte con información general disponible sobre {subject}. Si querés, además dejo la consulta en seguimiento para que un asesor la amplíe por este canal.',
    'Hay información general disponible sobre {subject}, pero para ampliarlo mejor conviene dejarlo en seguimiento y que un asesor te responda por aquí.',
  ],
  'customer.fallback.quote_handoff': [
    'Ya tengo la información necesaria de {subject}. Dejo la solicitud en seguimiento para que un asesor la revise y te responda a la brevedad.',
    'Perfecto. Ya quedó completo el intake de {subject}. Lo dejo en seguimiento para que un asesor tome la cotización y te responda a la brevedad.',
  ],
  'customer.capability.content_handoff': [
    'Puedo dejar esta consulta en seguimiento para que un asesor te amplíe la información por aquí.',
    'Ahora mismo conviene dejar esta consulta en seguimiento para que un asesor te comparta la información por este canal.',
  ],
  'customer.capability.commerce_handoff': [
    'Puedo tomar los datos necesarios y dejar la solicitud en seguimiento para que un asesor continúe la cotización por aquí.',
    'En este momento la consulta comercial queda mejor en seguimiento con un asesor. Si querés, dejo el intake encaminado por este canal.',
  ],
  'customer.capability.scheduling_handoff': [
    'Puedo relevar los datos de la visita y dejarla en seguimiento para que un asesor confirme la disponibilidad por aquí.',
    'Ahora mismo la agenda queda en seguimiento con un asesor. Si querés, tomo los datos y dejo la coordinación encaminada por este canal.',
  ],
}

const normalizeOverrideVariants = (overrides, key) => {
  if (!overrides || typeof overrides !== 'object') {
    return []
  }

  const rawValue = overrides[key]
  if (typeof rawValue === 'string' && rawValue.trim()) {
    return [rawValue.trim()]
  }
  if (!Array.isArray(rawValue)) {
    return []
  }

  return rawValue
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
}

export const pickWordingVariant = ({
  key,
  variationSeed = '',
  variables = {},
  fallback = '',
  overrides = null,
}) => {
  const overrideVariants = normalizeOverrideVariants(overrides, key)
  const variants = overrideVariants.length
    ? overrideVariants
    : Array.isArray(WORDING_REGISTRY[key])
      ? WORDING_REGISTRY[key]
      : []
  if (!variants.length) {
    return interpolateTemplate(fallback, variables)
  }

  const normalizedSeed = String(variationSeed || '')
  const index =
    !normalizedSeed || variants.length === 1
      ? 0
      : hashSeed(`${key}:${normalizedSeed}`) % variants.length
  return interpolateTemplate(variants[index], variables)
}

export const hasWordingVariantKey = (key) =>
  Array.isArray(WORDING_REGISTRY[key]) && WORDING_REGISTRY[key].length > 0
