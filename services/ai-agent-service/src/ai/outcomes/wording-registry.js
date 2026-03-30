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

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const DEFAULT_MAX_CHARS = 220
const DEFAULT_CHANNEL_PROFILE = 'chat'

const CHAT_CHANNELS = new Set([
  'whatsapp',
  'instagram',
  'messenger',
  'webchat',
  'admin_chat',
])

const templateEntry = (messages, meta = {}) => ({
  messages,
  ...meta,
})

const normalizeChannelValue = (value) => String(value || '').trim().toLowerCase()

export const resolveWordingChannelProfile = (channel) => {
  const normalized = normalizeChannelValue(channel)
  if (normalized === 'email') {
    return 'email'
  }

  if (!normalized || CHAT_CHANNELS.has(normalized)) {
    return DEFAULT_CHANNEL_PROFILE
  }

  return DEFAULT_CHANNEL_PROFILE
}

const RAW_WORDING_REGISTRY = {
  'customer.faq.product_availability': templateEntry(
    [
      'Sí, trabajamos con {topic}. Si querés, te oriento según luz, privacidad y uso.',
      'Sí, tenemos {topic}. Si me contás qué necesitás resolver, te digo qué opciones convienen más.',
      'Claro, manejamos {topic}. Si querés, te resumo alternativas según el ambiente o el resultado que buscás.',
      'Sí, hay opciones de {topic}. Decime qué estás buscando y te encamino por la variante más adecuada.',
    ],
    {
      goal: 'Responder disponibilidad de producto con naturalidad sin repetir una fórmula rígida.',
      allowHybridRewrite: false,
      maxChars: 220,
    },
  ),
  'customer.faq.product_general': templateEntry(
    [
      'Sí, trabajamos con {topic}. Si querés, te oriento según luz, privacidad y uso.',
      'Sí, tenemos {topic}. Si me contás qué necesitás resolver, te digo qué opciones convienen más.',
      'Claro, manejamos {topic}. Si querés, te resumo alternativas según el ambiente o el resultado que buscás.',
      'Sí, hay opciones de {topic}. Decime qué estás buscando y te encamino por la variante más adecuada.',
    ],
    {
      goal: 'Responder una consulta general de producto con tono natural y guiando la conversación.',
      allowHybridRewrite: false,
      maxChars: 220,
    },
  ),
  'customer.product.info_offer': templateEntry(
    [
      'Sí, trabajamos con {topic}. Si querés, te oriento según luz, privacidad y uso.',
      'Sí, tenemos {topic}. Si me contás qué necesitás resolver, te digo qué opciones convienen más.',
      'Claro, manejamos {topic}. Si querés, te resumo alternativas según el ambiente o el resultado que buscás.',
      'Sí, hay opciones de {topic}. Decime qué estás buscando y te encamino por la variante más adecuada.',
    ],
    {
      goal: 'Confirmar disponibilidad de la familia o variante consultada y orientar el siguiente paso.',
      allowHybridRewrite: false,
      maxChars: 220,
    },
  ),
  'customer.product.options_offer': templateEntry(
    [
      'Perfecto, trabajamos con varios tipos de {topic}. ¿Tenés alguno en mente o querés que te cuente opciones?',
      'Claro, manejamos distintas opciones de {topic}. ¿Querés que te muestre alternativas o ya tenés alguna en mente?',
      'Sí, dentro de {topic} hay varias alternativas. Si querés, te digo cuáles suelen conviene más según el uso.',
      'Perfecto. Hay distintas opciones de {topic}. Decime qué buscás lograr y te oriento por dónde ir.',
    ],
    {
      goal: 'Guiar una exploración de opciones sin caer en intake rígido.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 220,
    },
  ),
  'customer.product.light_filter_guidance.roller': templateEntry(
    [
      'Si buscás {topic} que deje pasar luz, normalmente se orienta a screen. Si querés, te cuento la diferencia con blackout y cuál conviene más según privacidad y ambiente.',
      'Si la idea es que {topic} deje pasar luz, por lo general se mira screen. Si querés, te explico en qué cambia frente a blackout y qué suele rendir mejor según el espacio.',
      'Para {topic} con paso de luz, lo habitual es ir por screen. Si querés, te comparo screen y blackout según luz, privacidad y uso.',
    ],
    {
      goal: 'Explicar el paso de luz sin perder el hilo del producto consultado.',
      allowHybridRewrite: false,
      maxChars: 240,
    },
  ),
  'customer.faq.product_general_with_evidence': [
    'Sí, trabajamos con {topic}. {evidence} Si quieres, te cuento opciones y usos según lo que necesitas.',
    'Sí, contamos con {topic}. {evidence} Si quieres, te amplío beneficios y aplicaciones según lo que necesitas.',
  ],
  'customer.faq.payment_methods': templateEntry(
    [
      'Aceptamos {paymentMethods}. Si querés, te indico cuál conviene según el medio de pago; y si esto sigue sobre un caso ya abierto, lo dejo en seguimiento por acá.',
      'Aceptamos {paymentMethods}. Si querés, te aclaro condiciones según el medio que prefieras; y si esto forma parte de un caso en curso, lo dejo en seguimiento por este canal.',
      'Aceptamos {paymentMethods}. Si querés, te digo cómo aplica cada opción; y si esto sigue por una gestión ya iniciada, lo dejo en seguimiento por acá.',
    ],
    {
      goal: 'Responder medios de pago de forma breve y útil.',
      allowHybridRewrite: false,
      maxChars: 200,
      channelProfiles: {
        email: {
          messages: [
            'Aceptamos {paymentMethods}. Si lo preferís, te detallo las condiciones aplicables a cada medio de pago; y si esto corresponde a un caso ya iniciado, lo dejo en seguimiento por este medio.',
            'Aceptamos {paymentMethods}. Si te sirve, te indico por este medio las condiciones según la forma de pago elegida; y si esto forma parte de una gestión en curso, lo dejo en seguimiento.',
          ],
          goal: 'Responder medios de pago con un tono más formal para email.',
          allowHybridRewrite: false,
          maxChars: 280,
        },
      },
    },
  ),
  'customer.faq.payment_methods_operational_followup': templateEntry(
    [
      'Aceptamos {paymentMethods}. Si ya mandaste el comprobante o el material, lo dejo en seguimiento y seguimos por acá.',
      'Aceptamos {paymentMethods}. Si ya enviaste el adjunto o el comprobante, lo dejo en seguimiento y continuamos por este canal.',
    ],
    {
      goal:
        'Responder medios de pago dentro de un hilo operativo sin perder la continuidad del seguimiento.',
      allowHybridRewrite: false,
      maxChars: 220,
      channelProfiles: {
        email: {
          messages: [
            'Aceptamos {paymentMethods}. Si ya enviaste el comprobante o el material, lo dejo en seguimiento y continuamos por este medio.',
          ],
          goal:
            'Responder medios de pago en contexto operativo con un tono más formal para email.',
          allowHybridRewrite: false,
          maxChars: 260,
        },
      },
    },
  ),
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
  'customer.schedule.availability_followup': templateEntry(
    [
      'Todavía no te puedo confirmar una franja exacta por acá. Si querés, pasame la dirección y un teléfono de contacto y lo dejamos encaminado para coordinar la visita.',
      'No te puedo cerrar un horario exacto por este medio todavía. Si te sirve, pasame la dirección y un teléfono de contacto y lo dejamos encaminado para coordinar la visita.',
    ],
    {
      goal:
        'Responder preguntas de franja u horario dentro de una coordinación ya abierta, sin degradarlas a FAQ general de horario comercial.',
      allowHybridRewrite: false,
      mustAskQuestion: false,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Todavía no puedo confirmarte una franja exacta por este medio. Si te parece, respondeme con la dirección y un teléfono de contacto y lo dejamos encaminado para coordinar la visita.',
          ],
          goal:
            'Mantener un tono más formal en email para consultas de horario dentro de una coordinación en curso.',
          allowHybridRewrite: false,
          maxChars: 300,
        },
      },
    },
  ),
  'customer.support.followup': [
    'Claro. Si necesitás una revisión o ajuste, contame qué producto es y qué habría que revisar, y coordinamos cómo seguir.',
    'Perfecto. Si se trata de service o postventa, decime qué producto es y qué habría que ajustar, y lo encaminamos.',
  ],
  'customer.support.product_identification': templateEntry(
    [
      'Bien. Si es {subject}, contame qué habría que reparar o qué está fallando, y lo encaminamos.',
      'Perfecto. Si se trata de {subject}, decime qué habría que revisar o reparar, y seguimos desde ahí.',
    ],
    {
      goal:
        'Mantener continuidad de service cuando el cliente solo identifica el producto ya instalado, sin degradarlo a exploración comercial.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 220,
      channelProfiles: {
        email: {
          messages: [
            'Perfecto. Si se trata de {subject}, indicame qué habría que revisar o reparar y continuamos desde ahí.',
          ],
          goal:
            'Mantener un tono más formal en email cuando el cliente identifica el producto dentro de un caso de service.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 260,
        },
      },
    },
  ),
  'customer.support.review_visit_payment': templateEntry(
    [
      'Claro. Podemos coordinar una revisión para ver qué conviene hacer. Trabajamos con efectivo, transferencia bancaria y tarjetas, y el costo final se confirma según lo que haya que revisar. Si te sirve, pasame la dirección y un teléfono de contacto.',
      'Perfecto. Podemos coordinar una revisión para evaluar qué conviene hacer. Aceptamos efectivo, transferencia bancaria y tarjetas, y el costo final se confirma según lo que haya que revisar. Si querés, pasame la dirección y un teléfono de contacto.',
    ],
    {
      goal:
        'Proponer una revisión técnica sin sonar rígido, incluyendo medios de pago conocidos sin cerrar condiciones que todavía deben confirmarse.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 320,
      channelProfiles: {
        email: {
          messages: [
            'Podemos coordinar una revisión para evaluar qué conviene hacer. Trabajamos con efectivo, transferencia bancaria y tarjetas, y el costo final se confirma según lo que haya que revisar. Si estás de acuerdo, respondeme con la dirección y un teléfono de contacto.',
          ],
          goal:
            'Mantener un tono más formal y prolijo en email para revisiones técnicas, incluyendo medios de pago conocidos.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 360,
        },
      },
    },
  ),
  'customer.support.review_or_change': templateEntry(
    [
      'Claro. Podemos coordinar una revisión para ver si conviene reparar o cambiarlo. Si querés, mandame una foto y pasame la zona o dirección y qué día u horario te queda mejor.',
      'Perfecto. Podemos coordinar una revisión para ver si conviene repararlo o cambiarlo. Si querés, mandame una foto y pasame la zona o dirección y qué día u horario te sirve mejor.',
    ],
    {
      goal: 'Proponer revisión técnica y pedir solo los datos mínimos para avanzar.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
    },
  ),
  'customer.support.review_visit': templateEntry(
    [
      'Claro. Podemos coordinar una revisión para ver qué conviene hacer. Si te sirve, pasame la zona o dirección y qué día u horario te queda mejor.',
      'Perfecto. Podemos coordinar una revisión para evaluar qué conviene hacer. Si querés, pasame la zona o dirección y qué día u horario te sirve.',
    ],
    {
      goal: 'Mantener una propuesta de revisión técnica breve y natural.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
    },
  ),
  'customer.support.component_replacement': [
    'Claro. Si es por cambio de enrollador o cinta de {subject}, lo trabajamos como service. Si querés, mandame una foto y la zona o dirección, y lo encaminamos.',
    'Perfecto. Si es por cambio de enrollador o cinta de {subject}, lo vemos como service. Si querés, pasame una foto y la zona o dirección, y lo encaminamos.',
  ],
  'customer.support.component_replacement_priced': [
    'Claro. Si es por cambio de enrollador o cinta de {subject}, lo trabajamos como service. Para pasarte un costo más exacto necesito confirmar si es solo eso o si hay algo más para revisar. Si querés, mandame una foto y la zona o dirección, y lo encaminamos.',
    'Perfecto. Si es por cambio de enrollador o cinta de {subject}, lo vemos como service. Para orientarte mejor con el costo necesito confirmar si es solo eso o si hay algo más para revisar. Si querés, pasame una foto y la zona o dirección, y lo encaminamos.',
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
  'customer.quote.waiting_followup_ack': templateEntry(
    [
      'Gracias a vos. Si querés revisar alguna opción o aclarar algo del presupuesto, seguimos por acá.',
      'Perfecto, gracias. Si querés repasar alguna parte del presupuesto o aclarar algo, seguimos por este medio.',
    ],
    {
      goal:
        'Responder un agradecimiento sobre un presupuesto ya enviado sin reiniciar la conversación como si fuera una consulta nueva.',
      allowHybridRewrite: false,
      maxChars: 180,
      channelProfiles: {
        email: {
          messages: [
            'Gracias a vos. Si querés revisar alguna parte del presupuesto o necesitás una aclaración, continuamos por este mismo medio.',
          ],
          goal:
            'Mantener un tono más formal en email cuando el cliente agradece un presupuesto ya enviado.',
          allowHybridRewrite: false,
          maxChars: 220,
        },
      },
    },
  ),
  'customer.quote.clarification_followup': templateEntry(
    [
      'Claro. Para no cambiarte nada de lo ya cotizado, dejo la aclaración en seguimiento para revisión del total y de los detalles a la brevedad.',
      'Perfecto. Para no darte un dato distinto al presupuesto ya enviado, lo dejo en seguimiento para revisar el total y aclararte cada detalle por este medio.',
    ],
    {
      goal: 'Aclarar un presupuesto ya emitido sin reiniciar el flujo comercial.',
      allowHybridRewrite: false,
      maxChars: 220,
    },
  ),
  'customer.quote.handoff_ready': [
    'Gracias por la información enviada. Le enviamos la cotización a la brevedad. Si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
    'Gracias por la información enviada. Ya quedó encaminada la solicitud y le enviamos la cotización a la brevedad. Si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
  ],
  'customer.quote.replacement_followup': templateEntry(
    [
      'Perfecto. Para orientarte mejor con {subjectClause}, pasame una foto y las medidas que tengas. Si querés, además decime la zona o dirección y lo dejamos encaminado.',
      'Claro. Para presupuestar {subjectClause}, mandame una foto y las medidas que tengas. Si querés, sumá también la zona o dirección y seguimos desde ahí.',
    ],
    {
      goal:
        'Pedir foto, medidas y ubicación cuando el cliente quiere reemplazar o cambiar elementos ya instalados, sin tratarlo como un quote genérico.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Perfecto. Para orientarte mejor con {subjectClause}, enviame una foto y las medidas que tengas. Si te parece, respondeme además con la zona o dirección y continuamos desde ahí.',
          ],
          goal:
            'Mantener un tono más formal en email para cambios o reemplazos sobre elementos ya instalados.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 300,
        },
      },
    },
  ),
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
  'customer.multimodal.generic_artifact_received': templateEntry(
    [
      'Recibí {artifactLabel}. Si esto es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.',
      'Perfecto, ya recibí {artifactLabel}. Si corresponde a un comprobante o documento, lo dejo en seguimiento. Si es para revisar o consultar algo, contame en una línea qué necesitás y lo encamino.',
    ],
    {
      goal:
        'Dar continuidad útil a adjuntos sin contexto suficiente, sin convertir el nombre del archivo en un tema falso.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 260,
      channelProfiles: {
        email: {
          messages: [
            'Recibí {artifactLabel}. Si corresponde a un comprobante o a documentación, lo dejo en seguimiento. Si es para revisar o consultar algo, respondeme en una línea qué necesitás y continuamos desde ahí.',
          ],
          goal: 'Mantener una continuidad multimodal neutral y más formal en email.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 320,
        },
      },
    },
  ),
  'customer.multimodal.generic_artifact_planned': templateEntry(
    [
      'Dale, enviámelo cuando puedas. Si es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.',
      'Perfecto. Cuando mandes el adjunto, si corresponde a un comprobante o documento lo dejo en seguimiento. Si es para revisar o consultar algo, contame en una línea qué necesitás y lo encaminamos.',
    ],
    {
      goal:
        'Mantener continuidad útil cuando el cliente anuncia adjuntos pero todavía no hay suficiente contexto.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 270,
      channelProfiles: {
        email: {
          messages: [
            'Perfecto. Cuando envíes el archivo adjunto, si corresponde a un comprobante o documentación lo dejo en seguimiento. Si es para revisar o consultar algo, respondeme en una línea qué necesitás y continuamos desde ahí.',
          ],
          goal: 'Mantener continuidad multimodal neutral en email cuando el adjunto todavía no llegó.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 330,
        },
      },
    },
  ),
  'customer.multimodal.generic_artifact_reference': templateEntry(
    [
      'Sí, con {artifactReferenceLabel} ya tengo una mejor referencia. Si es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.',
      'Sí, con {artifactReferenceLabel} ya se entiende mejor. Si corresponde a un comprobante o documento, lo dejo en seguimiento. Si es para revisar o consultar algo, contame en una línea qué necesitás y lo encamino.',
    ],
    {
      goal:
        'Responder referencias cortas a adjuntos cuando todavía no hay suficiente contexto comercial u operativo.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 270,
      channelProfiles: {
        email: {
          messages: [
            'Sí, con {artifactReferenceLabel} ya tengo una mejor referencia. Si corresponde a un comprobante o documentación, lo dejo en seguimiento. Si es para revisar o consultar algo, respondeme en una línea qué necesitás y continuamos desde ahí.',
          ],
          goal: 'Responder referencias neutrales a adjuntos con tono formal en email.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 330,
        },
      },
    },
  ),
  'customer.multimodal.support_artifact_received': templateEntry(
    [
      'Recibí el adjunto y lo dejo en seguimiento para revisar el caso. Si querés, pasame la zona o dirección y qué día u horario te sirve.',
      'Perfecto, ya recibí el adjunto. Lo dejo en seguimiento para revisar el caso y, si querés, decime la zona o dirección y qué día u horario te queda bien.',
    ],
    {
      goal: 'Dar continuidad útil a service/postventa cuando llegan adjuntos dentro del hilo.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Recibí el archivo adjunto y lo dejo en seguimiento para revisar el caso. Si te parece, respondeme con la zona o dirección y el día u horario que te sirva.',
          ],
          goal: 'Mantener continuidad más formal en email cuando llegan adjuntos de soporte.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 300,
        },
      },
    },
  ),
  'customer.multimodal.support_artifact_planned': templateEntry(
    [
      'Perfecto. Cuando me pases las fotos o el material lo dejo en seguimiento para revisarlo con más contexto. Si querés, además decime la zona o dirección y qué día u horario te sirve.',
      'Dale, enviámelo cuando puedas. Con eso dejo mejor encaminada la revisión en seguimiento. Si querés, de paso pasame la zona o dirección y un día u horario que te quede bien.',
    ],
    {
      goal: 'Mantener continuidad útil cuando el cliente anuncia que va a enviar fotos o material para soporte.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Perfecto. Cuando me envíes las fotos o el material lo dejo en seguimiento para revisarlo con más contexto. Si te parece, respondeme además con la zona o dirección y el día u horario que te sirva.',
          ],
          goal: 'Mantener continuidad formal en email cuando el cliente anuncia adjuntos de soporte.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 300,
        },
      },
    },
  ),
  'customer.multimodal.support_artifact_reference': templateEntry(
    [
      'Sí, con eso ya queda mejor orientada la revisión y lo dejo en seguimiento. Si querés, pasame la zona o dirección y qué día u horario te sirve y lo dejamos encaminado.',
      'Sí, con eso ya se entiende mejor para revisarlo. Lo dejo en seguimiento y, si querés, decime la zona o dirección y qué día u horario te queda bien.',
    ],
    {
      goal: 'Responder referencias cortas a adjuntos dentro de un hilo de soporte sin perder foco operativo.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Sí, con eso ya queda mejor orientada la revisión y lo dejo en seguimiento. Si te parece, respondeme con la zona o dirección y el día u horario que te sirva y lo dejamos encaminado.',
          ],
          goal: 'Responder referencias multimodales de soporte con tono formal en email.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 300,
        },
      },
    },
  ),
  'customer.multimodal.quote_artifact_received': templateEntry(
    [
      'Recibí el adjunto. Lo sumo como referencia para {subject} y dejo el caso en seguimiento. {nextStep}',
      'Perfecto, ya recibí el adjunto. Queda asociado a {subject} y lo dejo en seguimiento. {nextStep}',
    ],
    {
      goal: 'Mantener continuidad multimodal dentro de cotización sin volver a un intake genérico.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Recibí el archivo adjunto. Lo sumo como referencia para {subject} y lo dejo en seguimiento. {nextStep}',
          ],
          goal: 'Mantener continuidad formal en email cuando llegan adjuntos de cotización.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 300,
        },
      },
    },
  ),
  'customer.multimodal.quote_artifact_planned': templateEntry(
    [
      'Perfecto. Cuando me pases las fotos o el material lo tomo como referencia para {subject} y lo dejo en seguimiento. {nextStep}',
      'Dale, enviámelo cuando puedas. Con eso seguimos {subject} con mejor referencia y lo dejo en seguimiento. {nextStep}',
    ],
    {
      goal: 'Mantener continuidad útil cuando el cliente anuncia que enviará material en un hilo de cotización.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Perfecto. Cuando me envíes las fotos o el material lo tomo como referencia para {subject} y lo dejo en seguimiento. {nextStep}',
          ],
          goal: 'Mantener continuidad formal en email cuando el cliente anuncia adjuntos de cotización.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 300,
        },
      },
    },
  ),
  'customer.multimodal.quote_artifact_reference': templateEntry(
    [
      'Sí, con eso ya tengo mejor referencia para {subject} y la sumo a la cotización. {nextStep}',
      'Sí, con eso ya se entiende mejor para avanzar con {subject} y lo tomo como referencia para la cotización. {nextStep}',
    ],
    {
      goal: 'Resolver follow-ups cortos sobre adjuntos dentro de cotización.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 220,
      channelProfiles: {
        email: {
          messages: [
            'Sí, con eso ya tengo mejor referencia para avanzar con {subject} y lo dejo en seguimiento. {nextStep}',
          ],
          goal: 'Responder referencias multimodales de cotización con tono formal en email.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 280,
        },
      },
    },
  ),
  'customer.reengagement.neutral_followup': templateEntry(
    [
      'Claro, retomamos por acá. Decime si esto sigue por una cotización, una revisión o un pago, y te encamino desde ahí.',
      'Perfecto, seguimos con eso. Para no mezclar temas, decime si querés retomar una cotización, una revisión o un seguimiento de pago.',
    ],
    {
      goal:
        'Retomar un hilo cuando hay referencia explícita al tema anterior pero el contexto disponible no alcanza para asumir quote o soporte.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 220,
      channelProfiles: {
        email: {
          messages: [
            'Claro, retomamos por acá. Para no mezclar temas, indicame si esto continúa por una cotización, una revisión o un pago, y sigo desde ahí.',
          ],
          goal: 'Retomar un hilo de forma neutral y más formal en email.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 280,
        },
      },
    },
  ),
  'customer.reengagement.support_followup': templateEntry(
    [
      'Claro, retomamos con la revisión. Si querés, pasame la zona o dirección y qué día u horario te sirve, o mandame una foto si todavía no la enviaste.',
      'Perfecto, retomamos con eso. Si querés, decime la zona o dirección y qué día u horario te queda bien, o mandame una foto para revisarlo mejor.',
    ],
    {
      goal: 'Reenganchar un caso de soporte/postventa sin resetearlo a cotización.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 240,
      channelProfiles: {
        email: {
          messages: [
            'Claro, retomamos con la revisión. Si te parece, respondeme con la zona o dirección y el día u horario que te sirva, o enviame una foto si todavía no la mandaste.',
          ],
          goal: 'Retomar un caso de soporte con tono más formal en email.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 300,
        },
      },
    },
  ),
  'customer.reengagement.quote_followup': templateEntry(
    [
      'Claro, retomamos con esa cotización. Si querés, confirmame la opción o el dato que faltaba y seguimos desde ahí.',
      'Perfecto, seguimos con eso. Si querés, decime la opción o el dato que faltaba y retomamos desde ahí.',
    ],
    {
      goal: 'Retomar una cotización previa sin reiniciar el intake completo.',
      allowHybridRewrite: false,
      mustAskQuestion: true,
      maxChars: 220,
      channelProfiles: {
        email: {
          messages: [
            'Claro, retomamos esa cotización. Si te parece, confirmame la opción o el dato que faltaba y continuamos desde ahí.',
          ],
          goal: 'Retomar una cotización previa con tono más formal en email.',
          allowHybridRewrite: false,
          mustAskQuestion: true,
          maxChars: 280,
        },
      },
    },
  ),
}

const normalizeMessages = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? [normalized] : []
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const normalizeScopedTemplateMap = (value) => {
  if (!isPlainObject(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawEntry]) => {
        const normalizedKey = normalizeChannelValue(key)
        const entry = normalizeWordingEntry(rawEntry)
        return normalizedKey && entry ? [normalizedKey, entry] : null
      })
      .filter(Boolean),
  )
}

const normalizeWordingEntry = (rawValue) => {
  if (typeof rawValue === 'string' || Array.isArray(rawValue)) {
    const messages = normalizeMessages(rawValue)
    return messages.length
      ? {
          messages,
          goal: null,
          mustAskQuestion: false,
          maxChars: null,
          allowHybridRewrite: false,
          channels: {},
          channelProfiles: {},
        }
      : null
  }

  if (!isPlainObject(rawValue)) {
    return null
  }

  const messages = normalizeMessages(
    rawValue.messages ?? rawValue.variants ?? rawValue.templates ?? rawValue.message,
  )
  if (!messages.length) {
    return null
  }

  return {
    messages,
    goal:
      typeof rawValue.goal === 'string' && rawValue.goal.trim()
        ? rawValue.goal.trim()
        : null,
    mustAskQuestion: rawValue.mustAskQuestion === true,
    maxChars:
      Number.isFinite(Number(rawValue.maxChars)) && Number(rawValue.maxChars) > 0
        ? Math.max(80, Math.min(400, Number(rawValue.maxChars)))
        : null,
    allowHybridRewrite: rawValue.allowHybridRewrite === true,
    channels: normalizeScopedTemplateMap(rawValue.channels),
    channelProfiles: normalizeScopedTemplateMap(
      rawValue.channelProfiles ?? rawValue.profiles,
    ),
  }
}

const normalizeWordingRegistry = (rawRegistry) => {
  if (!isPlainObject(rawRegistry)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(rawRegistry)
      .map(([key, rawValue]) => {
        const normalizedKey = String(key || '').trim()
        const entry = normalizeWordingEntry(rawValue)
        return normalizedKey && entry ? [normalizedKey, entry] : null
      })
      .filter(Boolean),
  )
}

const DEFAULT_WORDING_REGISTRY = normalizeWordingRegistry(RAW_WORDING_REGISTRY)

const mergeTemplateEntries = (baseEntry = null, overrideEntry = null) => {
  if (!baseEntry && !overrideEntry) {
    return null
  }
  if (!baseEntry) {
    return overrideEntry
  }
  if (!overrideEntry) {
    return baseEntry
  }

  return {
    messages: overrideEntry.messages?.length
      ? overrideEntry.messages
      : baseEntry.messages,
    goal: overrideEntry.goal ?? baseEntry.goal ?? null,
    mustAskQuestion:
      overrideEntry.mustAskQuestion === true || baseEntry.mustAskQuestion === true,
    maxChars: overrideEntry.maxChars ?? baseEntry.maxChars ?? null,
    allowHybridRewrite:
      overrideEntry.allowHybridRewrite === true || baseEntry.allowHybridRewrite === true,
    channels: {
      ...(baseEntry.channels || {}),
      ...(overrideEntry.channels || {}),
    },
    channelProfiles: {
      ...(baseEntry.channelProfiles || {}),
      ...(overrideEntry.channelProfiles || {}),
    },
  }
}

const resolveScopedTemplateEntry = ({
  entry = null,
  channel = null,
  channelProfile = null,
} = {}) => {
  if (!entry) {
    return null
  }

  const effectiveProfile =
    normalizeChannelValue(channelProfile) || resolveWordingChannelProfile(channel)
  const normalizedChannel = normalizeChannelValue(channel)
  const channelEntry =
    normalizedChannel && isPlainObject(entry.channels)
      ? entry.channels[normalizedChannel] || null
      : null
  const profileEntry =
    effectiveProfile && isPlainObject(entry.channelProfiles)
      ? entry.channelProfiles[effectiveProfile] || null
      : null

  return mergeTemplateEntries(entry, mergeTemplateEntries(profileEntry, channelEntry))
}

export const getWordingTemplate = ({
  key,
  registry = null,
  overrides = null,
  channel = null,
  channelProfile = null,
} = {}) => {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) {
    return null
  }

  const configuredRegistry = normalizeWordingRegistry(registry)
  const overrideRegistry = normalizeWordingRegistry(overrides)
  const baseEntry = DEFAULT_WORDING_REGISTRY[normalizedKey] || null
  const configuredEntry = configuredRegistry[normalizedKey] || null
  const overrideEntry = overrideRegistry[normalizedKey] || null

  const mergedEntry = mergeTemplateEntries(
    mergeTemplateEntries(baseEntry, configuredEntry),
    overrideEntry,
  )

  return resolveScopedTemplateEntry({
    entry: mergedEntry,
    channel,
    channelProfile,
  })
}

export const getWordingTemplateMeta = ({
  key,
  registry = null,
  overrides = null,
  channel = null,
  channelProfile = null,
} = {}) => {
  const entry = getWordingTemplate({
    key,
    registry,
    overrides,
    channel,
    channelProfile,
  })
  if (!entry) {
    return {
      goal: null,
      mustAskQuestion: false,
      maxChars: DEFAULT_MAX_CHARS,
      allowHybridRewrite: false,
    }
  }

  return {
    goal: entry.goal ?? null,
    mustAskQuestion: entry.mustAskQuestion === true,
    maxChars:
      Number.isFinite(Number(entry.maxChars)) && Number(entry.maxChars) > 0
        ? Number(entry.maxChars)
        : DEFAULT_MAX_CHARS,
    allowHybridRewrite: entry.allowHybridRewrite === true,
  }
}

export const pickWordingVariant = ({
  key,
  variationSeed = '',
  variables = {},
  fallback = '',
  overrides = null,
  registry = null,
  channel = null,
  channelProfile = null,
}) => {
  const entry = getWordingTemplate({
    key,
    registry,
    overrides,
    channel,
    channelProfile,
  })
  const variants = Array.isArray(entry?.messages) ? entry.messages : []

  if (!variants.length) {
    return interpolateTemplate(fallback, variables)
  }

  const normalizedSeed = String(variationSeed || '')
  const index =
    !normalizedSeed || variants.length === 1
      ? 0
      : hashSeed(`${String(key || '')}:${normalizedSeed}`) % variants.length
  return interpolateTemplate(variants[index], variables)
}

export const hasWordingVariantKey = (
  key,
  registry = null,
  overrides = null,
  channel = null,
  channelProfile = null,
) =>
  Boolean(
    getWordingTemplate({
      key,
      registry,
      overrides,
      channel,
      channelProfile,
    })?.messages?.length,
  )

export const normalizeExternalWordingRegistry = (value) =>
  normalizeWordingRegistry(value)
