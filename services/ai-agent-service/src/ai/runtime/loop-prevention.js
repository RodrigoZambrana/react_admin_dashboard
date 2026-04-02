const buildLoopIntervention = (overrides = {}) => ({
  applied: false,
  strategy: null,
  reason: null,
  lane: null,
  requestedField: null,
  requestedFieldResolved: false,
  repeatedResponse: false,
  semanticOverlapLoop: false,
  semanticOverlapScore: 0,
  ...overrides,
})

export const preventCustomerResponseLoop = ({
  response,
  previousSnapshot = null,
  interpretation = null,
  tenantRuntimePolicy = null,
  dependencies = {},
} = {}) => {
  if (!response || typeof response !== 'object') {
    return {
      response,
      loopIntervention: buildLoopIntervention({
        reason: 'invalid_response',
      }),
    }
  }

  const {
    compactText,
    normalizeText,
    readInterpretationResolutionReadiness,
    looksLikePaymentProofArtifact,
    looksLikePaymentProofFollowUpRequest,
    looksLikePaymentOperationalUpdate,
    filterResolvedConversationFields,
    isConversationFieldResolved,
    normalizeIntentKeyValue,
    sanitizeLoopSubjectLabel,
    buildClosureContinuationReply,
    hasPaymentContinuationSignal,
    looksLikeAmountOnlyReply,
    looksLikeAwaitingProofResponse,
    looksLikeGenericClarificationResponse,
    looksLikeGenericContactResponse,
    looksLikeGenericConsultationClosureResponse,
    looksLikeGenericQuoteHandoffResponse,
    looksLikeGenericQuoteIntakeResponse,
    looksLikeOperationalStatusContinuation,
    looksLikeLightClosureFollowUp,
    looksLikeClosureContinuationResponse,
    looksLikeQuoteDetailFollowUp,
    looksLikeCoordinationAskResponse,
    looksLikeAttachmentReference,
    hasCatalogVocabularySignal,
    looksLikeGenericPriceInquiry,
    looksLikeAddressOrTimeReply,
  } = dependencies

  const responseText = compactText(response?.finalUserText || response?.text || '')
  if (!responseText) {
    return {
      response,
      loopIntervention: buildLoopIntervention({
        reason: 'empty_response',
      }),
    }
  }

  const currentTurnText = String(
    interpretation?.currentTurnText ||
      interpretation?.effectiveInput ||
      interpretation?.originalInput ||
      '',
  )
  const paymentProofContinuityInput =
    looksLikePaymentProofArtifact(currentTurnText) ||
    looksLikePaymentProofFollowUpRequest(currentTurnText) ||
    looksLikePaymentOperationalUpdate(currentTurnText)

  const previousAgentTurn = Array.isArray(previousSnapshot?.turns)
    ? [...previousSnapshot.turns]
        .reverse()
        .find((entry) => entry?.role === 'agent' && typeof entry?.text === 'string')
    : null
  const previousAgentText = compactText(previousAgentTurn?.text || '')
  const tokenizeLoopText = (value) =>
    normalizeText(value)
      .split(/[^a-z0-9]+/u)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 3)
  const tokenJaccard = (left, right) => {
    const leftSet = new Set(left)
    const rightSet = new Set(right)
    if (!leftSet.size && !rightSet.size) {
      return 1
    }
    const intersection = Array.from(leftSet).filter((token) =>
      rightSet.has(token),
    ).length
    const union = new Set([...leftSet, ...rightSet]).size
    return union === 0 ? 0 : intersection / union
  }
  const overlapScore =
    previousAgentText && responseText
      ? tokenJaccard(
          tokenizeLoopText(previousAgentText),
          tokenizeLoopText(responseText),
        )
      : 0
  const repeatedResponse =
    previousAgentText &&
    normalizeText(previousAgentText) === normalizeText(responseText)
  const loopingResponse =
    previousAgentText && !repeatedResponse && overlapScore >= 0.78

  if (paymentProofContinuityInput && !repeatedResponse && !loopingResponse) {
    return {
      response,
      loopIntervention: buildLoopIntervention({
        reason: 'payment_proof_continuity',
        repeatedResponse: Boolean(repeatedResponse),
        semanticOverlapLoop: Boolean(loopingResponse),
        semanticOverlapScore: overlapScore,
      }),
    }
  }

  const readiness = readInterpretationResolutionReadiness(interpretation)
  const missingFields = Array.isArray(readiness?.missingFields)
    ? readiness.missingFields.filter((entry) => typeof entry === 'string')
    : []
  const conversationState =
    interpretation?.conversationState && typeof interpretation.conversationState === 'object'
      ? interpretation.conversationState
      : null
  const effectiveMissingFields = filterResolvedConversationFields({
    missingFields,
    conversationState,
  })
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const supportContext =
    interpretation?.supportContext && typeof interpretation.supportContext === 'object'
      ? interpretation.supportContext
      : null
  const scheduleContext =
    interpretation?.scheduleContext && typeof interpretation.scheduleContext === 'object'
      ? interpretation.scheduleContext
      : null
  const resolveRequestedFieldFromResponse = (text) => {
    const normalized = normalizeText(text)
    if (!normalized) {
      return null
    }
    if (/\b(zona|direccion|dirección|domicilio|ubicacion|ubicación)\b/u.test(normalized)) {
      return 'address'
    }
    if (/\b(que dia|qué día|dia te sirve|día te sirve)\b/u.test(normalized)) {
      return 'date'
    }
    if (
      /\b(horario|franja|a que hora|a qué hora|hora te queda|hora te sirve)\b/u.test(
        normalized,
      )
    ) {
      return 'time'
    }
    if (/\b(cuantas unidades|cuántas unidades|cantidad)\b/u.test(normalized)) {
      return 'quantity'
    }
    if (
      /\b(medidas|ancho por alto|medida aproximada|medidas aproximadas)\b/u.test(
        normalized,
      )
    ) {
      return 'measurements'
    }
    if (
      /\b(que producto|qué producto|que solucion|qué solución|que queres cotizar|qué querés cotizar)\b/u.test(
        normalized,
      )
    ) {
      return 'product'
    }
    return null
  }
  const requestedField = resolveRequestedFieldFromResponse(responseText)
  const asksResolvedField =
    requestedField && isConversationFieldResolved(requestedField, conversationState)
  const quantity = Number(quoteContext?.quantity?.total || readiness?.knownFacts?.quantity || 0)
  const measurementItems = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems.filter((entry) => entry && typeof entry === 'object')
    : []
  const measurementItemCount = measurementItems.length
  const hasMultipleMeasurementItems = measurementItemCount > 1
  const measurementsLabel =
    quoteContext?.measurements?.displayLabel ||
    quoteContext?.measurements?.confirmationLabel ||
    null
  const measurementStateNote = hasMultipleMeasurementItems
    ? `me quedan ${measurementItemCount} medidas aproximadas`
    : measurementsLabel
      ? `me queda ${measurementsLabel}`
      : null
  const measurementAcknowledgementText = hasMultipleMeasurementItems
    ? `Tomo ${measurementItemCount} medidas aproximadas`
    : measurementsLabel
      ? `Tomo una medida aproximada de ${measurementsLabel}`
      : null
  const effectiveIntentKey = normalizeIntentKeyValue(
    interpretation?.intent?.key || readiness?.turnIntent || null,
  )
  const previousQuoteSubject = compactText(conversationState?.slots?.product?.value || '')
  const currentQuoteSubject = compactText(
    quoteContext?.topicLabel || quoteContext?.familyLabel || '',
  )
  const currentTurnAddsFreshMeasurement =
    /\d/.test(String(currentTurnText || '')) &&
    /\b(?:x|×|ancho|alto|cm|mm|mts?|metros?)\b/i.test(
      String(currentTurnText || ''),
    )
  const stableQuoteSubject = sanitizeLoopSubjectLabel(
    previousQuoteSubject &&
      currentQuoteSubject &&
      normalizeText(previousQuoteSubject).includes(normalizeText(currentQuoteSubject)) &&
      previousQuoteSubject.split(/\s+/u).length > currentQuoteSubject.split(/\s+/u).length
      ? previousQuoteSubject
      : currentQuoteSubject || previousQuoteSubject || null,
  )
  const hasActiveQuoteThread = Boolean(
    quoteContext?.topicLabel ||
      quoteContext?.familyLabel ||
      quantity > 0 ||
      measurementsLabel ||
      measurementItemCount > 0,
  )
  const hasQuoteProgressContext = Boolean(
    measurementsLabel || measurementItemCount > 0 || quantity > 0 || conversationState?.lastAskedSlot,
  )
  const quoteLoopBreakEligible =
    (readiness?.lane === 'quote' || quoteContext) &&
    effectiveIntentKey !== 'customer.schedule_request' &&
    effectiveIntentKey !== 'customer.support_request' &&
    !scheduleContext &&
    !supportContext
  const initialReadyQuoteHandoff =
    !previousAgentText &&
    ['ready_for_pricing_or_handoff', 'ready_for_handoff'].includes(
      String(quoteContext?.completionStatus || ''),
    ) &&
    looksLikeGenericQuoteHandoffResponse(responseText)
  if (initialReadyQuoteHandoff) {
    return {
      response,
      loopIntervention: buildLoopIntervention({
        reason: 'initial_ready_handoff',
        lane: readiness?.lane || null,
        requestedField,
        requestedFieldResolved: Boolean(asksResolvedField),
        repeatedResponse: Boolean(repeatedResponse),
        semanticOverlapLoop: Boolean(loopingResponse),
        semanticOverlapScore: overlapScore,
      }),
    }
  }
  const courtesyContinuationCandidate =
    looksLikeLightClosureFollowUp(currentTurnText) &&
    ((readiness?.lane === 'quote' && hasActiveQuoteThread) ||
      readiness?.lane === 'support' ||
      readiness?.lane === 'schedule' ||
      quoteContext ||
      supportContext ||
      scheduleContext) &&
    (looksLikeGenericContactResponse(responseText) ||
      looksLikeGenericQuoteIntakeResponse(responseText) ||
      looksLikeGenericQuoteHandoffResponse(responseText) ||
      looksLikeCoordinationAskResponse(responseText))
  const quoteDetailContinuationCandidate =
    Boolean(previousAgentText) &&
    (readiness?.lane === 'quote' || quoteContext) &&
    hasQuoteProgressContext &&
    (looksLikeQuoteDetailFollowUp(currentTurnText) || currentTurnAddsFreshMeasurement) &&
    (looksLikeGenericQuoteIntakeResponse(responseText) ||
      looksLikeGenericQuoteHandoffResponse(responseText))
  const paymentFollowUpLoopCandidate =
    Boolean(previousAgentText) &&
    looksLikeAmountOnlyReply(currentTurnText) &&
    looksLikeGenericContactResponse(responseText) &&
    hasPaymentContinuationSignal(previousAgentText)
  const quoteSubjectSpecificityRegressionCandidate =
    hasActiveQuoteThread &&
    hasQuoteProgressContext &&
    Boolean(previousAgentText) &&
    (looksLikeQuoteDetailFollowUp(currentTurnText) || currentTurnAddsFreshMeasurement) &&
    stableQuoteSubject &&
    !normalizeText(responseText).includes(normalizeText(stableQuoteSubject)) &&
    Boolean(currentQuoteSubject) &&
    normalizeText(responseText).includes(normalizeText(currentQuoteSubject))
  const strongActiveThread =
    hasActiveQuoteThread ||
    Boolean(
      interpretation?.threadResolution?.activeThread?.displayLabel ||
        interpretation?.topic?.label ||
        interpretation?.contextTopic?.label ||
        supportContext?.issueSummary ||
        supportContext?.address ||
        scheduleContext?.address ||
        scheduleContext?.date?.dateLabel ||
        scheduleContext?.time?.timeLabel,
    )
  const fallbackContractCandidate =
    strongActiveThread &&
    !looksLikeLightClosureFollowUp(currentTurnText) &&
    (looksLikeGenericClarificationResponse(responseText) ||
      looksLikeGenericConsultationClosureResponse(responseText))
  const closureLoopCandidate =
    strongActiveThread &&
    !looksLikeLightClosureFollowUp(currentTurnText) &&
    looksLikeClosureContinuationResponse(responseText)
  const partialScheduleLoopCandidate =
    (readiness?.lane === 'schedule' || scheduleContext) &&
    /\b(d[ií]a y horario|horario y d[ií]a|qu[eé] d[ií]a y horario)\b/i.test(responseText) &&
    effectiveMissingFields.length === 1 &&
    ['date', 'time'].includes(String(effectiveMissingFields[0] || ''))

  const triggerReason =
    repeatedResponse
      ? 'repeated_response'
      : loopingResponse
        ? 'semantic_overlap'
        : courtesyContinuationCandidate
          ? 'courtesy_continuation'
          : quoteDetailContinuationCandidate
            ? 'quote_detail_continuation'
            : paymentFollowUpLoopCandidate
              ? 'payment_follow_up_loop'
              : quoteSubjectSpecificityRegressionCandidate
                ? 'quote_subject_specificity_regression'
                : asksResolvedField
                  ? 'requested_field_already_resolved'
                  : fallbackContractCandidate
                    ? 'fallback_contract_regression'
                    : closureLoopCandidate
                      ? 'closure_loop'
                      : partialScheduleLoopCandidate
                        ? 'partial_schedule_loop'
                        : null

  if (!triggerReason) {
    return {
      response,
      loopIntervention: buildLoopIntervention({
        lane: readiness?.lane || null,
        requestedField,
        requestedFieldResolved: Boolean(asksResolvedField),
        repeatedResponse: Boolean(repeatedResponse),
        semanticOverlapLoop: Boolean(loopingResponse),
        semanticOverlapScore: overlapScore,
      }),
    }
  }

  const buildQuoteLoopBreak = () => {
    if (looksLikeLightClosureFollowUp(currentTurnText)) {
      return buildClosureContinuationReply(previousAgentText)
    }

    const stateNotes = []
    if (stableQuoteSubject) {
      stateNotes.push(`ya tomé ${stableQuoteSubject}`)
    }
    if (measurementStateNote) {
      stateNotes.push(measurementStateNote)
    }
    if (quantity > 0) {
      stateNotes.push(quantity === 1 ? 'anoto 1 unidad' : `anoto ${quantity} unidades`)
    }
    const previousAgentAlreadyMentionsMeasurements =
      Boolean(previousAgentText) &&
      (
        hasMultipleMeasurementItems
          ? /\b\d+\s+medidas?(?:\s+aproximadas?)?\b/u.test(
              normalizeText(previousAgentText),
            ) || /\bmedidas indicadas\b/u.test(normalizeText(previousAgentText))
          : Boolean(measurementsLabel) &&
            normalizeText(previousAgentText).includes(normalizeText(measurementsLabel))
      )

    const remainingConfigurationEntries = (
      Array.isArray(quoteContext?.missingAttributes)
        ? quoteContext.missingAttributes
        : Array.isArray(quoteContext?.requiredAttributes)
          ? quoteContext.requiredAttributes.filter((attribute) =>
              effectiveMissingFields.includes(attribute?.key),
            )
          : []
    )
      .filter((attribute) => {
        const key = compactText(attribute?.key || '')
        if (!key) {
          return false
        }

        if (
          effectiveMissingFields.includes('measurements') &&
          (key === 'measurements' || key === 'measurement_items')
        ) {
          return false
        }

        if (effectiveMissingFields.includes('quantity') && key === 'quantity') {
          return false
        }

        if (effectiveMissingFields.includes('product') && key === 'product') {
          return false
        }

        return true
      })
      .map((attribute) => ({
        key: compactText(attribute?.key || ''),
        label: compactText(
          attribute?.label || attribute?.subjectPrefix || attribute?.key || '',
        ),
      }))
      .filter((entry) => entry.key && entry.label)
    const uniqueRemainingConfigurationEntries = Array.from(
      new Map(
        remainingConfigurationEntries.map((entry) => [
          normalizeText(entry.key || entry.label),
          entry,
        ]),
      ).values(),
    )
    const preferredRemainingConfigurationEntry =
      uniqueRemainingConfigurationEntries.length > 1 &&
      conversationState?.lastAskedSlot &&
      String(conversationState.lastAskedSlot) ===
        String(uniqueRemainingConfigurationEntries[0]?.key || '')
        ? uniqueRemainingConfigurationEntries[1]
        : uniqueRemainingConfigurationEntries[0] || null
    const nextTenantConfigurationLabel =
      preferredRemainingConfigurationEntry?.label || null
    const remainingConfigurationLabel =
      uniqueRemainingConfigurationEntries.length === 0
        ? null
        : uniqueRemainingConfigurationEntries.length === 1
          ? uniqueRemainingConfigurationEntries[0].label
          : `${uniqueRemainingConfigurationEntries
              .slice(0, -1)
              .map((entry) => entry.label)
              .join(', ')} y ${uniqueRemainingConfigurationEntries.at(-1)?.label}`
    const coreQuoteMissingFields = effectiveMissingFields.filter((field) =>
      ['measurements', 'quantity', 'product'].includes(String(field || '')),
    )
    const onlyTenantConfigurationPending =
      quoteLoopBreakEligible &&
      coreQuoteMissingFields.length === 0 &&
      Boolean(remainingConfigurationLabel)
    const repeatedMeasurementsAskCandidate =
      (repeatedResponse || loopingResponse) &&
      conversationState?.lastAskedSlot === 'dimensions' &&
      effectiveMissingFields.includes('measurements')
    const repeatedQuantityAskCandidate =
      (repeatedResponse || loopingResponse) &&
      conversationState?.lastAskedSlot === 'quantity' &&
      effectiveMissingFields.includes('quantity')

    const nextAsk =
      repeatedMeasurementsAskCandidate
        ? 'Si no las tenés exactas, pasame una medida aproximada o una foto y avanzo con eso.'
        : repeatedQuantityAskCandidate
          ? 'Si no sabés la cantidad exacta, decime aunque sea aproximada y sigo con eso.'
          : effectiveMissingFields.includes('measurements')
            ? remainingConfigurationLabel
              ? `Decime las medidas aproximadas (ancho por alto). Si ya lo sabés, después confirmame ${remainingConfigurationLabel}.`
              : 'Decime las medidas aproximadas (ancho por alto).'
            : effectiveMissingFields.includes('quantity')
              ? remainingConfigurationLabel
                ? `Decime cuántas unidades necesitás. Si ya lo sabés, además confirmame ${remainingConfigurationLabel}.`
                : 'Decime cuántas unidades necesitás.'
              : effectiveMissingFields.includes('product')
                ? 'Decime qué producto querés cotizar.'
                : nextTenantConfigurationLabel
                  ? stableQuoteSubject
                    ? `Para seguir con la cotización de ${stableQuoteSubject}, confirmame ${nextTenantConfigurationLabel}.`
                    : `Para seguir con la cotización, confirmame ${nextTenantConfigurationLabel}.`
                  : null
    if (quoteDetailContinuationCandidate) {
      return compactText(
        [
          'Perfecto.',
          stableQuoteSubject
            ? `Sumo ese dato para la misma cotización de ${stableQuoteSubject}.`
            : 'Sumo ese dato para la misma cotización.',
          nextAsk || 'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
        ]
          .filter(Boolean)
          .join(' '),
      )
    }
    if (quoteSubjectSpecificityRegressionCandidate && stableQuoteSubject) {
      if (
        measurementAcknowledgementText &&
        currentTurnAddsFreshMeasurement &&
        !previousAgentAlreadyMentionsMeasurements
      ) {
        return compactText(
          [
            'Perfecto.',
            `${measurementAcknowledgementText} para ${stableQuoteSubject}.`,
            nextAsk || 'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
          ].join(' '),
        )
      }
      return compactText(
        [
          'Perfecto.',
          `Sumo ese dato para la misma cotización de ${stableQuoteSubject}.`,
          nextAsk || 'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
        ].join(' '),
      )
    }
    if (onlyTenantConfigurationPending) {
      return compactText(
        [
          'Perfecto.',
          stateNotes.length ? `${stateNotes.join(', ')}.` : null,
          nextAsk,
        ]
          .filter(Boolean)
          .join(' '),
      )
    }
    if (!nextAsk) {
      return null
    }

    return compactText(
      [
        'Perfecto.',
        stateNotes.length ? `${stateNotes.join(', ')}.` : null,
        nextAsk,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  const buildSupportLoopBreak = () => {
    if (looksLikeLightClosureFollowUp(currentTurnText)) {
      return buildClosureContinuationReply(previousAgentText)
    }

    const stateNotes = []
    if (supportContext?.productType) {
      stateNotes.push(`ya tomo que es ${supportContext.productType}`)
    }
    if (supportContext?.issueSummary) {
      stateNotes.push('ya me queda qué habría que revisar')
    }
    if (supportContext?.address) {
      stateNotes.push('ya tengo la dirección')
    }

    const nextAsk =
      effectiveMissingFields.includes('issue')
        ? 'Contame qué falla o qué habría que revisar.'
        : effectiveMissingFields.includes('product')
          ? 'Decime qué producto es.'
          : effectiveMissingFields.includes('date')
            ? 'Decime qué día te sirve.'
            : effectiveMissingFields.includes('time')
              ? 'Decime qué horario te queda mejor.'
              : effectiveMissingFields.includes('address')
                ? 'Pasame la zona o dirección.'
                : effectiveMissingFields.includes('contact')
                  ? 'Pasame un teléfono o mail de contacto.'
                  : null
    if (!nextAsk) {
      return null
    }

    return compactText(
      [
        'Perfecto.',
        stateNotes.length ? `${stateNotes.join(', ')}.` : null,
        nextAsk,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  const buildScheduleLoopBreak = () => {
    if (looksLikeLightClosureFollowUp(currentTurnText)) {
      return buildClosureContinuationReply(previousAgentText)
    }

    const stateNotes = []
    if (scheduleContext?.address) {
      stateNotes.push('ya tengo la dirección')
    }

    const nextAsk =
      effectiveMissingFields.includes('date')
        ? 'Decime qué día te sirve.'
        : effectiveMissingFields.includes('time')
          ? 'Decime qué horario te queda mejor.'
          : effectiveMissingFields.includes('address')
            ? 'Pasame la zona o dirección.'
            : effectiveMissingFields.includes('contact')
              ? 'Pasame un teléfono o mail de contacto.'
              : null
    if (!nextAsk) {
      return null
    }

    return compactText(
      [
        'Perfecto.',
        stateNotes.length ? `${stateNotes.join(', ')}.` : null,
        nextAsk,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  const buildGenericLoopBreak = () => {
    const subjectLabel = sanitizeLoopSubjectLabel(
      interpretation?.topic?.label ||
        interpretation?.contextTopic?.label ||
        quoteContext?.topicLabel ||
        quoteContext?.familyLabel ||
        supportContext?.productType ||
        '',
    )

    if (looksLikeLightClosureFollowUp(currentTurnText)) {
      return buildClosureContinuationReply(previousAgentText)
    }

    if (looksLikeAwaitingProofResponse(responseText)) {
      if (looksLikePaymentProofArtifact(currentTurnText)) {
        return 'Perfecto. Recibí el comprobante y lo dejo en seguimiento para confirmar la acreditación a la brevedad.'
      }
      if (
        looksLikePaymentProofFollowUpRequest(currentTurnText) ||
        looksLikePaymentOperationalUpdate(currentTurnText)
      ) {
        return 'Perfecto. Quedo atento al comprobante por acá para dejarlo en seguimiento.'
      }
    }

    if (looksLikeGenericClarificationResponse(responseText)) {
      if (looksLikeOperationalStatusContinuation(currentTurnText)) {
        return 'Perfecto. Si esto sigue por coordinación o visita, pasame día, horario o dirección y avanzo por ahí.'
      }
      if (subjectLabel) {
        return `Claro. Si seguimos con ${subjectLabel}, decime si querés precio, fotos o material de referencia, o coordinar cómo seguir.`
      }
      if (looksLikeAttachmentReference(currentTurnText)) {
        return 'Perfecto. Recibí eso. Decime si esto sigue por una cotización, una revisión o una coordinación, y avanzo por ahí.'
      }
      return 'Perfecto. Para no mezclar temas, decime si esto sigue por una cotización, una revisión o una coordinación, y avanzo por ahí.'
    }

    if (looksLikeGenericConsultationClosureResponse(responseText)) {
      if (
        looksLikeGenericPriceInquiry(currentTurnText) ||
        hasCatalogVocabularySignal(currentTurnText, tenantRuntimePolicy)
      ) {
        return 'Claro. Si es por esa consulta, pasame la medida aproximada y te oriento con la cotización.'
      }
      if (/\b(ambas|los dos|las dos)\b/i.test(currentTurnText)) {
        return 'Perfecto. Si querés ambas opciones, te las comparo por acá. Si podés, pasame la medida aproximada.'
      }
    }

    if (looksLikeGenericContactResponse(responseText)) {
      if (readiness?.lane === 'schedule' || scheduleContext) {
        return (
          buildScheduleLoopBreak() ||
          'Perfecto. Con eso lo dejamos encaminado. Decime qué día u horario te queda mejor.'
        )
      }
      if (readiness?.lane === 'support' || supportContext) {
        return (
          buildSupportLoopBreak() ||
          'Perfecto. Con eso lo dejamos encaminado. Pasame zona o dirección y qué día u horario te queda bien.'
        )
      }
      if (
        /\b(tiempo de entrega|cuanto demora|cuánto demora|demora|cuanto tarda|cuánto tarda|tarda|plazo de entrega|entrega)\b/i.test(
          currentTurnText,
        )
      ) {
        return 'Claro. El tiempo de entrega se confirma según el trabajo y la agenda disponible. Si querés, te lo dejo encaminado para que te lo confirmen por acá.'
      }
      if (
        looksLikeAmountOnlyReply(currentTurnText) ||
        hasPaymentContinuationSignal(currentTurnText)
      ) {
        return 'Perfecto. Si vas a transferir o dejar una seña, cuando hagas el pago mandame el comprobante por acá y lo dejamos encaminado.'
      }
      if (looksLikeAddressOrTimeReply(currentTurnText)) {
        return 'Perfecto. Con eso ya lo encamino. Si querés coordinar visita o revisión, decime qué día u horario te queda mejor.'
      }
    }

    if (looksLikeGenericQuoteIntakeResponse(responseText)) {
      if (looksLikeOperationalStatusContinuation(currentTurnText)) {
        return 'Perfecto. Si preferís coordinar visita para medir o revisar, pasame la zona o dirección y qué día u horario te queda bien.'
      }
      if (
        subjectLabel &&
        /\b(foto|fotos|imagen|imagenes|material|catalogo|cat[aá]logo|referencias)\b/i.test(
          currentTurnText,
        )
      ) {
        return `Claro. Si querés referencias de ${subjectLabel}, lo dejo encaminado para compartir fotos o material por este canal.`
      }
    }

    if (looksLikeGenericQuoteHandoffResponse(responseText)) {
      if (looksLikeLightClosureFollowUp(currentTurnText)) {
        return buildClosureContinuationReply(previousAgentText)
      }
      if (
        /\b(tiempo de entrega|cuanto demora|cuánto demora|demora|cuanto tarda|cuánto tarda|tarda|plazo de entrega|entrega)\b/i.test(
          currentTurnText,
        )
      ) {
        return 'Claro. El tiempo de entrega se confirma según el trabajo y la agenda disponible. Si querés, te lo dejo encaminado para que te lo confirmen por acá.'
      }
      if (looksLikeQuoteDetailFollowUp(currentTurnText)) {
        return compactText(
          [
            'Perfecto.',
            subjectLabel
              ? `Sumo ese dato para la misma cotización de ${subjectLabel}.`
              : 'Sumo ese dato para la misma cotización.',
            'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
          ].join(' '),
        )
      }
    }

    return null
  }

  let rewrittenText = null
  let strategy = null
  if (quoteLoopBreakEligible) {
    rewrittenText = buildQuoteLoopBreak()
    if (rewrittenText) {
      strategy = 'quote_loop_break'
    }
  }

  if (!rewrittenText && (readiness?.lane === 'schedule' || scheduleContext)) {
    rewrittenText = buildScheduleLoopBreak()
    if (rewrittenText) {
      strategy = 'schedule_loop_break'
    }
  }

  if (!rewrittenText && (readiness?.lane === 'support' || supportContext)) {
    rewrittenText = buildSupportLoopBreak()
    if (rewrittenText) {
      strategy = 'support_loop_break'
    }
  }

  if (!rewrittenText) {
    rewrittenText = buildGenericLoopBreak()
    if (rewrittenText) {
      strategy = 'generic_loop_break'
    }
  }

  if (!rewrittenText || normalizeText(rewrittenText) === normalizeText(responseText)) {
    return {
      response,
      loopIntervention: buildLoopIntervention({
        strategy,
        reason: triggerReason,
        lane: readiness?.lane || null,
        requestedField,
        requestedFieldResolved: Boolean(asksResolvedField),
        repeatedResponse: Boolean(repeatedResponse),
        semanticOverlapLoop: Boolean(loopingResponse),
        semanticOverlapScore: overlapScore,
      }),
    }
  }

  return {
    response: {
      ...response,
      text: rewrittenText,
      finalUserText: rewrittenText,
      debug: {
        ...(response?.debug || {}),
        detail: response?.debug?.detail
          ? `${response.debug.detail} Se reformuló la salida para cortar un loop y avanzar con el próximo dato útil.`
          : 'Se reformuló la salida para cortar un loop y avanzar con el próximo dato útil.',
      },
    },
    loopIntervention: buildLoopIntervention({
      applied: true,
      strategy,
      reason: triggerReason,
      lane: readiness?.lane || null,
      requestedField,
      requestedFieldResolved: Boolean(asksResolvedField),
      repeatedResponse: Boolean(repeatedResponse),
      semanticOverlapLoop: Boolean(loopingResponse),
      semanticOverlapScore: overlapScore,
    }),
  }
}
