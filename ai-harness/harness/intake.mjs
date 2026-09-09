#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  applyEligiblePromotionsToTasks,
  applyPromotionToTasks,
  collectPromotionCandidates,
  findBacklogFragmentRelPath,
  indexTasks,
  reconstructBacklogViews,
} from './backlog-governance.mjs'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const defaultRoot = dirname(harnessDir)
const json = (value) => `${JSON.stringify(value, null, 2)}\n`

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'y', 'o', 'en', 'con',
  'para', 'por', 'que', 'se', 'su', 'sus', 'es', 'son', 'al', 'a', 'lo', 'le', 'les', 'como',
  'este', 'esta', 'esto', 'estos', 'estas', 'debe', 'deben', 'cada', 'incluido', 'incluidos',
  'incluidas', 'tambien', 'todavia', 'ser', 'hay', 'the', 'and', 'or', 'to', 'of', 'for',
  'in', 'on', 'an', 'as',
])

export class IntakeError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'IntakeError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new IntakeError(code, message)
}

const readJson = (path, label = path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail('INVALID_JSON', `${label}: ${error.message}`)
  }
}

export const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()

export const tokens = (value) =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))

export const coverage = (requirement, haystack) => {
  const required = tokens(requirement)
  if (!required.length) return 0
  const hay = new Set(tokens(haystack))
  return required.filter((token) => hay.has(token)).length / required.length
}

export const extractMaterialLines = (body) => {
  const match = String(body ?? '').match(/## Requisitos materiales\n([\s\S]*?)(?:\n## |\s*$)/u)
  if (!match) return []
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/u, '').trim())
    .filter(Boolean)
}

const pushError = (errors, code, message, path) => {
  errors.push({ code, message, path })
}

const statementById = (intake) => new Map((intake.statements ?? []).map((item) => [item.id, item]))
const requirementById = (intake) => new Map((intake.requirements ?? []).map((item) => [item.id, item]))

export const semanticDiff = (requirement, task, slice) => {
  const haystack = [
    slice?.result,
    slice?.gate,
    ...(slice?.scope?.in ?? []),
    ...(slice?.scope?.out ?? []),
    task?.objective,
    task?.title,
    ...(task?.acceptanceCriteria ?? []),
    ...(task?.scope?.in ?? []),
    ...(task?.verification ?? []),
  ].filter(Boolean).join(' ')
  const score = coverage(requirement.statement, haystack)
  const missingTokens = tokens(requirement.statement).filter((token) => !tokens(haystack).includes(token))
  return {
    requirementId: requirement.id,
    backlogTaskId: slice?.backlogTaskId ?? null,
    sliceId: slice?.id ?? null,
    coverage: score,
    missingTokens,
    covered: score >= 0.5,
  }
}

const validateShape = (intake, errors) => {
  if (intake?.schema !== 'ai-harness.intake/v1') pushError(errors, 'INVALID_SCHEMA', 'schema debe ser ai-harness.intake/v1.', 'schema')
  if (typeof intake?.id !== 'string' || !intake.id.trim()) pushError(errors, 'INVALID_ID', 'id es obligatorio.', 'id')
  if (typeof intake?.need !== 'string' || !intake.need.trim()) pushError(errors, 'INVALID_NEED', 'need es obligatorio.', 'need')
  if (!['prompt', 'document', 'conversation'].includes(intake?.request?.source)) {
    pushError(errors, 'INVALID_REQUEST', 'request.source inválido.', 'request.source')
  }
  if (typeof intake?.request?.body !== 'string' || !intake.request.body.trim()) {
    pushError(errors, 'INVALID_REQUEST', 'request.body es obligatorio.', 'request.body')
  }
  if (intake.fidelity?.reviewedAgainstSource !== true) {
    pushError(errors, 'FIDELITY_NOT_REVIEWED', 'fidelity.reviewedAgainstSource debe ser true.', 'fidelity')
  }
  if (Array.isArray(intake.inferredAnswers) && intake.inferredAnswers.length) {
    pushError(errors, 'INFERRED_HUMAN_ANSWER', 'El intake no puede conservar respuestas inferidas.', 'inferredAnswers')
  }
  if (intake.alternateBacklog != null || Array.isArray(intake.tasks)) {
    pushError(errors, 'PARALLEL_BACKLOG', 'El intake no puede declarar un backlog paralelo.', 'alternateBacklog')
  }
}

const validateStatements = (intake, errors) => {
  const ids = new Set()
  for (const [index, statement] of (intake.statements ?? []).entries()) {
    const path = `statements[${index}]`
    if (!statement?.id || ids.has(statement.id)) pushError(errors, 'INVALID_STATEMENT', 'statement.id duplicado o vacío.', path)
    ids.add(statement.id)
    if (!['fact', 'assumption', 'question'].includes(statement.kind)) {
      pushError(errors, 'INVALID_STATEMENT', `${statement.id}: kind inválido.`, path)
    }
    if (statement.kind === 'question') {
      if (statement.answer && statement.answeredBy !== 'human') {
        pushError(errors, 'INFERRED_HUMAN_ANSWER', `${statement.id}: una pregunta no puede resolverse por inferencia.`, path)
      }
      if (statement.answeredBy === 'human' && !String(statement.answer ?? '').trim()) {
        pushError(errors, 'INVALID_STATEMENT', `${statement.id}: answeredBy=human exige answer.`, path)
      }
    } else if (statement.answer || statement.answeredBy === 'human') {
      pushError(errors, 'INVALID_STATEMENT', `${statement.id}: solo las preguntas admiten answer humana.`, path)
    }
    if (statement.sourceSpan && !normalizeText(intake.request.body).includes(normalizeText(statement.sourceSpan))) {
      pushError(errors, 'UNGROUNDED_STATEMENT', `${statement.id}: sourceSpan no aparece en el pedido.`, path)
    }
  }
}

const validateRequirements = (intake, errors) => {
  const statements = statementById(intake)
  const ids = new Set()
  for (const [index, requirement] of (intake.requirements ?? []).entries()) {
    const path = `requirements[${index}]`
    if (!requirement?.id || ids.has(requirement.id)) pushError(errors, 'INVALID_REQUIREMENT', 'requirement.id duplicado o vacío.', path)
    ids.add(requirement.id)
    if (typeof requirement.statement !== 'string' || !requirement.statement.trim()) {
      pushError(errors, 'INVALID_REQUIREMENT', `${requirement.id}: statement obligatorio.`, path)
    }
    if (typeof requirement.material !== 'boolean') pushError(errors, 'INVALID_REQUIREMENT', `${requirement.id}: material debe ser boolean.`, path)
    if (typeof requirement.product !== 'string' || !requirement.product.trim()) {
      pushError(errors, 'INVALID_REQUIREMENT', `${requirement.id}: product obligatorio.`, path)
    }
    for (const statementId of requirement.statementIds ?? []) {
      if (!statements.has(statementId)) pushError(errors, 'MISSING_STATEMENT', `${requirement.id} -> ${statementId}`, path)
    }
    const span = requirement.sourceSpan ?? requirement.statement
    if (!normalizeText(intake.request.body).includes(normalizeText(span))) {
      pushError(errors, 'UNGROUNDED_REQUIREMENT', `${requirement.id}: no está anclado al pedido.`, path)
    }
  }
}

const validateSlices = (intake, errors) => {
  const requirements = requirementById(intake)
  const ids = new Set()
  const claimed = new Map()
  for (const [index, slice] of (intake.slices ?? []).entries()) {
    const path = `slices[${index}]`
    if (!slice?.id || ids.has(slice.id)) pushError(errors, 'INVALID_SLICE', 'slice.id duplicado o vacío.', path)
    ids.add(slice.id)
    if (typeof slice.result !== 'string' || !slice.result.trim()) pushError(errors, 'INVALID_SLICE', `${slice.id}: result obligatorio.`, path)
    if (typeof slice.product !== 'string' || !slice.product.trim()) pushError(errors, 'INVALID_SLICE', `${slice.id}: product obligatorio.`, path)
    if (typeof slice.gate !== 'string' || !slice.gate.trim()) pushError(errors, 'INVALID_SLICE', `${slice.id}: gate obligatorio.`, path)
    if (!Array.isArray(slice.scope?.in) || !slice.scope.in.length || !Array.isArray(slice.scope?.out) || !slice.scope.out.length) {
      pushError(errors, 'INVALID_SLICE', `${slice.id}: scope.in y scope.out son obligatorios.`, path)
    }
    if (!Array.isArray(slice.requirementIds) || !slice.requirementIds.length) {
      pushError(errors, 'INVALID_SLICE', `${slice.id}: requirementIds obligatorio.`, path)
    }
    const clusters = new Set()
    const products = new Set()
    for (const requirementId of slice.requirementIds ?? []) {
      const requirement = requirements.get(requirementId)
      if (!requirement) {
        pushError(errors, 'MISSING_REQUIREMENT', `${slice.id} -> ${requirementId}`, path)
        continue
      }
      products.add(requirement.product)
      if (requirement.cluster) clusters.add(requirement.cluster)
      if (claimed.has(requirementId) && !slice.sharedTransaction) {
        pushError(errors, 'MIXED_REQUIREMENTS', `${requirementId} está en más de un slice independiente.`, path)
      }
      claimed.set(requirementId, slice.id)
      if (requirement.product !== slice.product) {
        pushError(errors, 'MIXED_REQUIREMENTS', `${slice.id} mezcla el producto ${requirement.product} con ${slice.product}.`, path)
      }
    }
    if ((products.size > 1 || clusters.size > 1) && slice.sharedTransaction !== true) {
      pushError(errors, 'MIXED_REQUIREMENTS', `${slice.id} mezcla resultados independientes sin transacción compartida.`, path)
    }
  }
}

const validateScopeChanges = (intake, errors) => {
  for (const [index, change] of (intake.scopeChanges ?? []).entries()) {
    const path = `scopeChanges[${index}]`
    if (!['decision', 'supersession'].includes(change?.kind)) {
      pushError(errors, 'INVALID_SCOPE_CHANGE', 'Un cambio de alcance debe ser decision o supersession.', path)
    }
    if (typeof change?.summary !== 'string' || !change.summary.trim()) {
      pushError(errors, 'INVALID_SCOPE_CHANGE', 'El cambio de alcance requiere summary.', path)
    }
    if (change?.kind === 'supersession' && !/^DEC-\d{3}$/u.test(change.decisionRef ?? '')) {
      pushError(errors, 'INVALID_SCOPE_CHANGE', 'Una supersesión exige decisionRef DEC-xxx.', path)
    }
  }
}

const validateMaterialFidelity = (intake, errors) => {
  const declared = extractMaterialLines(intake.request?.body)
  const material = (intake.requirements ?? []).filter(({ material }) => material)
  for (const line of declared) {
    const conserved = material.some((requirement) =>
      coverage(line, requirement.statement) >= 0.5
      || normalizeText(requirement.statement).includes(normalizeText(line))
      || normalizeText(line).includes(normalizeText(requirement.statement)),
    )
    if (!conserved) {
      pushError(errors, 'LOST_REQUIREMENT', `Requisito material no conservado: ${line}`, 'requirements')
    }
  }
  const linked = new Set((intake.slices ?? []).flatMap((slice) => slice.requirementIds ?? []))
  for (const requirement of material) {
    if (!linked.has(requirement.id)) {
      pushError(errors, 'LOST_REQUIREMENT', `${requirement.id} no está trazado a ningún slice.`, `requirements.${requirement.id}`)
    }
  }
}

const unansweredQuestions = (intake) =>
  (intake.statements ?? []).filter((statement) =>
    statement.kind === 'question' && statement.answeredBy !== 'human',
  )

const isSliceDone = (slice, taskById) =>
  Boolean(slice?.backlogTaskId && taskById.get(slice.backlogTaskId)?.status === 'done')

export const recommendedNextSlice = (intake, taskById = new Map()) => {
  const slices = intake.slices ?? []
  const byId = new Map(slices.map((slice) => [slice.id, slice]))
  const pending = slices.filter((slice) => !isSliceDone(slice, taskById))
  const unblocked = pending.filter((slice) =>
    (slice.dependsOn ?? []).every((id) => {
      const dependency = byId.get(id)
      return !dependency || isSliceDone(dependency, taskById)
    }),
  )
  const stillNeeded = new Set(pending.flatMap((slice) => slice.dependsOn ?? []))
  return unblocked.find((slice) => stillNeeded.has(slice.id)) ?? unblocked[0] ?? null
}

export const evaluateIntake = (intake, backlog = { tasks: [] }, options = {}) => {
  const errors = []
  validateShape(intake, errors)
  validateStatements(intake, errors)
  validateRequirements(intake, errors)
  validateSlices(intake, errors)
  validateScopeChanges(intake, errors)
  validateMaterialFidelity(intake, errors)

  const tasks = backlog.tasks ?? []
  const taskById = indexTasks(tasks)
  const requirements = requirementById(intake)
  const diffs = []
  for (const slice of intake.slices ?? []) {
    const task = slice.backlogTaskId ? taskById.get(slice.backlogTaskId) : null
    if (slice.backlogTaskId && !task) {
      pushError(errors, 'MISSING_BACKLOG_TASK', `${slice.id} apunta a ${slice.backlogTaskId}, que no existe en el backlog canónico.`, `slices.${slice.id}`)
    }
    for (const requirementId of slice.requirementIds ?? []) {
      const requirement = requirements.get(requirementId)
      if (!requirement) continue
      const diff = semanticDiff(requirement, task, slice)
      diffs.push(diff)
      if (task && !diff.covered) {
        pushError(errors, 'SEMANTIC_GAP', `${requirement.id} no está cubierto por ${slice.backlogTaskId}.`, `slices.${slice.id}`)
      }
    }
  }

  const questions = unansweredQuestions(intake)
  const promotions = collectPromotionCandidates(tasks, options.promotion)
  const views = reconstructBacklogViews(tasks)
  const nextSlice = recommendedNextSlice(intake, taskById)
  const ready = errors.length === 0 && questions.length === 0

  return {
    schema: 'ai-harness.intake-report/v1',
    intakeId: intake?.id ?? null,
    valid: errors.length === 0,
    ready,
    errors,
    classifications: {
      facts: (intake.statements ?? []).filter(({ kind }) => kind === 'fact').map(({ id }) => id),
      assumptions: (intake.statements ?? []).filter(({ kind }) => kind === 'assumption').map(({ id }) => id),
      questions: (intake.statements ?? []).filter(({ kind }) => kind === 'question').map(({ id }) => id),
      unansweredQuestions: questions.map(({ id, text }) => ({ id, text })),
    },
    recommendedNextSliceId: nextSlice?.id ?? null,
    views,
    requirementTaskDiffs: diffs,
    promotions: {
      candidates: promotions,
      applied: false,
      started: false,
    },
    mutatedAuthority: false,
  }
}

const writePromotedTasks = (root, backlogPath, backlog, nextTasks, applied) => {
  writeFileSync(backlogPath, json({ ...backlog, tasks: nextTasks }))
  const paths = [backlogPath]
  for (const item of applied) {
    const fragmentRel = findBacklogFragmentRelPath(root, item.taskId)
    if (!fragmentRel) continue
    const fragmentPath = join(root, fragmentRel)
    const fragment = readJson(fragmentPath, fragmentPath)
    fragment.tasks = applyPromotionToTasks(fragment.tasks ?? [], item.taskId)
    writeFileSync(fragmentPath, json(fragment))
    paths.push(fragmentPath)
  }
  return [...new Set(paths)]
}

export const applyPromotion = (root, taskId, { start = false, dryRun = false } = {}) => {
  if (start) fail('PROMOTION_MUST_NOT_START', 'La promoción gobernada no puede iniciar el trabajo.')
  const backlogPath = join(root, 'planning/backlog.json')
  const backlog = readJson(backlogPath, backlogPath)
  const candidates = collectPromotionCandidates(backlog.tasks ?? [])
  const candidate = candidates.find((item) => item.taskId === taskId)
  if (!candidate) fail('PROMOTION_NOT_ELIGIBLE', `${taskId} no es un candidato de promoción.`)
  if (dryRun) {
    return {
      schema: 'ai-harness.promotion-proposal/v1',
      taskId,
      candidate,
      applied: false,
      started: false,
      mutatedAuthority: false,
    }
  }
  const nextTasks = applyPromotionToTasks(backlog.tasks ?? [], taskId)
  const paths = writePromotedTasks(root, backlogPath, backlog, nextTasks, [candidate])
  return {
    schema: 'ai-harness.promotion-receipt/v1',
    taskId,
    candidate,
    applied: true,
    started: false,
    mutatedAuthority: true,
    actor: 'harness',
    paths,
  }
}

export const applyEligiblePromotions = (root, { start = false, dryRun = false } = {}) => {
  if (start) fail('PROMOTION_MUST_NOT_START', 'La promoción gobernada no puede iniciar el trabajo.')
  const backlogPath = join(root, 'planning/backlog.json')
  const backlog = readJson(backlogPath, backlogPath)
  const candidates = collectPromotionCandidates(backlog.tasks ?? [])
  if (dryRun) {
    return {
      schema: 'ai-harness.promotion-proposal/v1',
      candidates,
      applied: false,
      started: false,
      mutatedAuthority: false,
    }
  }
  if (!candidates.length) {
    return {
      schema: 'ai-harness.promotion-receipt/v1',
      appliedIds: [],
      candidates: [],
      applied: false,
      started: false,
      mutatedAuthority: false,
      actor: 'harness',
      paths: [],
    }
  }
  const { tasks: nextTasks, applied } = applyEligiblePromotionsToTasks(backlog.tasks ?? [])
  const paths = writePromotedTasks(root, backlogPath, backlog, nextTasks, applied)
  return {
    schema: 'ai-harness.promotion-receipt/v1',
    appliedIds: applied.map(({ taskId }) => taskId),
    candidates: applied,
    applied: true,
    started: false,
    mutatedAuthority: true,
    actor: 'harness',
    paths,
  }
}

const parseCli = (argv) => {
  const args = [...argv]
  const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'evaluate'
  const values = new Map()
  const flags = new Set()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (!flag.startsWith('--')) fail('INVALID_ARGUMENT', `Argumento inesperado: ${flag}`)
    const next = args[index + 1]
    if (next === undefined || next.startsWith('--')) {
      flags.add(flag)
      continue
    }
    values.set(flag, next)
    index += 1
  }
  return { command, values, flags }
}

const loadBacklog = (root, explicit) =>
  readJson(explicit ?? join(root, 'planning/backlog.json'), 'backlog')

export const runIntakeCli = (argv = process.argv.slice(2), { root = defaultRoot, stdout = process.stdout } = {}) => {
  const { command, values, flags } = parseCli(argv)
  if (command === 'promotions') {
    const backlog = loadBacklog(root, values.get('--backlog'))
    stdout.write(json({
      schema: 'ai-harness.promotion-proposal/v1',
      candidates: collectPromotionCandidates(backlog.tasks ?? []),
      views: reconstructBacklogViews(backlog.tasks ?? []),
      mutatedAuthority: false,
      started: false,
    }))
    return
  }
  if (command === 'apply-promotion' || command === 'promote') {
    const options = { start: flags.has('--start'), dryRun: flags.has('--dry-run') }
    const taskId = values.get('--id')
    if (flags.has('--eligible') && taskId) {
      fail('INVALID_ARGUMENT', 'apply-promotion acepta --id o --eligible, no ambos.')
    }
    if (!flags.has('--eligible') && !taskId) {
      fail('INVALID_ARGUMENT', 'apply-promotion requiere --id <taskId> o --eligible.')
    }
    const result = flags.has('--eligible')
      ? applyEligiblePromotions(root, options)
      : applyPromotion(root, taskId, options)
    stdout.write(json(result))
    return
  }
  if (command !== 'evaluate' && command !== 'validate') fail('INVALID_COMMAND', 'Uso: intake evaluate|promotions|apply-promotion')
  const file = values.get('--file')
  if (!file) fail('INVALID_ARGUMENT', 'evaluate requiere --file <intake.json>.')
  const intake = readJson(file, file)
  const backlog = loadBacklog(root, values.get('--backlog'))
  const report = evaluateIntake(intake, backlog)
  stdout.write(json(report))
  if (!report.valid) process.exitCode = 1
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  try {
    runIntakeCli()
  } catch (error) {
    console.error(`${error.code ?? 'INTAKE_ERROR'}: ${error.message}`)
    process.exitCode = 1
  }
}
