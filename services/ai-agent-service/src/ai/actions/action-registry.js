import { ACTION_REGISTRY } from './action-types.js'

export const getActionDefinition = (actionKey) => {
  if (!actionKey) {
    return null
  }

  return ACTION_REGISTRY[actionKey] || null
}

export const listRegisteredActions = () => Object.values(ACTION_REGISTRY)

export const getActionExecutionDefinition = (actionKey) => {
  const definition = getActionDefinition(actionKey)
  return definition?.execute || null
}

export const listConfirmableActions = () =>
  listRegisteredActions().filter((entry) => entry.requiresConfirmation)

const buildResultSummaryText = (normalizedStep, fallbackLabel) => {
  const entityLabel = normalizedStep.entityLabel || 'elemento'
  const applyGender = (masculine, feminine) =>
    /a$/i.test(entityLabel) ? feminine : masculine

  switch (normalizedStep.resultShape) {
    case 'resource_created':
      return `${entityLabel} ${applyGender('creado', 'creada')}`
    case 'resource_updated':
      return `${entityLabel} ${applyGender('actualizado', 'actualizada')}`
    case 'resource_deleted':
      return `${entityLabel} ${applyGender('eliminado', 'eliminada')}`
    case 'status_updated':
      return `estado de ${entityLabel} actualizado`
    case 'comment_updated':
      return `comentario de ${entityLabel} actualizado`
    case 'outbound_sent':
      return `${entityLabel} ${applyGender('enviado', 'enviada')}`
    case 'document_confirmed':
      return `${entityLabel} ${applyGender('confirmado', 'confirmada')}`
    default:
      return fallbackLabel || entityLabel
  }
}

export const normalizeExecutionStep = (step) => {
  if (!step?.toolName) {
    return null
  }

  for (const definition of listRegisteredActions()) {
    if (definition?.execute?.toolName === step.toolName) {
      return {
        ...step,
        verifyEntity:
          step.verifyEntity ?? definition.execute.verifyEntity ?? null,
        verifyMode:
          step.verifyMode ??
          definition.execute.verifyMode ??
          (definition.execute.verifyEntity ? 'detail' : 'none'),
        backendMethod: definition.execute.backendMethod,
        requiresTargetId: Boolean(definition.execute.requiresTargetId),
        entityLabel:
          step.entityLabel ?? definition.execute.entityLabel ?? null,
        resultShape:
          step.resultShape ?? definition.execute.resultShape ?? null,
      }
    }
  }

  return {
    ...step,
    verifyEntity: step.verifyEntity ?? null,
    verifyMode: step.verifyMode ?? (step.verifyEntity ? 'detail' : 'none'),
    backendMethod: null,
    requiresTargetId: false,
    entityLabel: step.entityLabel ?? null,
    resultShape: step.resultShape ?? null,
  }
}

export const shapeRegisteredExecutionResult = (step, result) => {
  const normalizedStep = normalizeExecutionStep(step)
  const fallbackLabel =
    normalizedStep.successLabel ??
    result?.name ??
    result?.title ??
    result?.customer?.name ??
    result?.quoteNumber ??
    result?.uuid ??
    (normalizedStep.targetId != null ? `#${normalizedStep.targetId}` : 'Elemento')

  switch (normalizedStep.resultShape) {
    case 'resource_deleted':
      return {
        label: fallbackLabel,
        verifyEntity: null,
        verifyMode: 'none',
        verificationResult: null,
        resultShape: normalizedStep.resultShape ?? null,
        entityLabel: normalizedStep.entityLabel ?? null,
        shouldVerify: false,
        summaryText: buildResultSummaryText(normalizedStep, fallbackLabel),
      }
    case 'status_updated':
    case 'comment_updated':
    case 'outbound_sent':
    case 'document_confirmed':
    case 'resource_created':
    case 'resource_updated':
    default:
      return {
        label: fallbackLabel,
        verifyEntity: normalizedStep.verifyEntity ?? null,
        verifyMode: normalizedStep.verifyMode ?? 'detail',
        verificationResult: result ?? null,
        resultShape: normalizedStep.resultShape ?? null,
        entityLabel: normalizedStep.entityLabel ?? null,
        shouldVerify:
          (normalizedStep.verifyMode ?? 'detail') !== 'none' &&
          Boolean(normalizedStep.verifyEntity),
        summaryText: buildResultSummaryText(normalizedStep, fallbackLabel),
      }
  }
}

export const executeRegisteredActionStep = async (step, backendClient) => {
  const normalizedStep = normalizeExecutionStep(step)
  if (!normalizedStep?.toolName) {
    throw new Error('missing execution tool name')
  }

  const execution = {
    name: normalizedStep.toolName,
    arguments:
      normalizedStep.targetId != null
        ? { id: normalizedStep.targetId, ...(normalizedStep.payload ?? {}) }
        : { ...(normalizedStep.payload ?? {}) },
  }

  if (!normalizedStep.backendMethod) {
    throw new Error(`unsupported tool ${normalizedStep.toolName}`)
  }

  if (
    normalizedStep.requiresTargetId &&
    normalizedStep.targetId == null
  ) {
    throw new Error(`missing targetId for ${normalizedStep.toolName}`)
  }

  const backendFn = backendClient?.[normalizedStep.backendMethod]
  if (typeof backendFn !== 'function') {
    throw new Error(
      `backend method ${normalizedStep.backendMethod} is not available for ${normalizedStep.toolName}`,
    )
  }

  const result =
    normalizedStep.targetId != null
      ? await backendFn.call(
          backendClient,
          normalizedStep.targetId,
          normalizedStep.payload,
        )
      : await backendFn.call(backendClient, normalizedStep.payload)

  const resultSummary = shapeRegisteredExecutionResult(normalizedStep, result)

  return {
    ...execution,
    result,
    status: 'executed',
    verifyEntity: normalizedStep.verifyEntity ?? null,
    verifyMode: normalizedStep.verifyMode ?? null,
    resultShape: normalizedStep.resultShape ?? null,
    resultSummary,
    successLabel: normalizedStep.successLabel ?? null,
  }
}
