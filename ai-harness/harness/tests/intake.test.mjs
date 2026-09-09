import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyEligiblePromotions,
  applyPromotion,
  coverage,
  evaluateIntake,
  extractMaterialLines,
  recommendedNextSlice,
  runIntakeCli,
  semanticDiff,
} from '../intake.mjs'

const root = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))
const requestPath = join(root, 'ai-harness/harness/tests/fixtures/intake/long-commerce-metrics-request.md')
const requestBody = readFileSync(requestPath, 'utf8')
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

const syntheticBacklog = () => ({
  schemaVersion: 1,
  generatedAt: '2026-09-09',
  tasks: [
    {
      id: 'T-DEP',
      title: 'Dependencia cerrada',
      product: 'AI Harness',
      status: 'done',
      objective: 'Cerrar la dependencia previa',
      acceptanceCriteria: ['La dependencia está done.'],
      dependencies: [],
      decisionsRequired: [],
    },
    {
      id: 'T-HAR',
      title: 'Intake fiel al pedido',
      product: 'AI Harness',
      status: 'ready',
      objective: 'Conservar cada requisito material del pedido, declarar resultado observable alcance producto dueño y gate verificable, y trazar slices al backlog canónico planning/backlog.json sin lista paralela',
      acceptanceCriteria: [
        'Un intake conserva cada requisito material del pedido.',
        'Cada slice declara resultado, alcance, producto dueño y gate verificable.',
        'Los slices se trazan al backlog canónico y no a una lista paralela.',
      ],
      scope: { in: ['schema de intake'], out: ['backlog paralelo'] },
      verification: ['Fixtures de prompts extensos y diffs semánticos.'],
      dependencies: ['T-DEP'],
      decisionsRequired: [],
    },
    {
      id: 'T-CHK',
      title: 'Cerrar checkout ecommerce',
      product: 'commerce-suite',
      status: 'ready',
      objective: 'Cerrar el checkout ecommerce del piloto con compra E2E certificada como resultado independiente',
      acceptanceCriteria: ['El cierre de checkout ecommerce queda certificado para el piloto.'],
      dependencies: [],
      decisionsRequired: [],
    },
    {
      id: 'T-MET',
      title: 'Contrato canónico de métricas',
      product: 'growth-metrics',
      status: 'ready',
      objective: 'Especificar el contrato canónico de eventos y conversión de métricas independiente del checkout',
      acceptanceCriteria: ['El contrato de métricas distingue vista, carrito, checkout y compra.'],
      dependencies: [],
      decisionsRequired: [],
    },
    {
      id: 'T-PAY',
      title: 'Medio de cobro del piloto',
      product: 'commerce-suite',
      status: 'blocked',
      blockingReason: 'Espera decisión humana.',
      objective: 'No inferir si el medio oficial de cobro del piloto es Mercado Pago o transferencia bancaria',
      acceptanceCriteria: ['La decisión humana del medio de cobro queda registrada antes de implementar.'],
      dependencies: ['T-DEP'],
      decisionsRequired: ['Definir el medio oficial de cobro del piloto UruCortinas.'],
    },
    {
      id: 'T-PRO',
      title: 'Promoción gobernada',
      product: 'AI Harness',
      status: 'ready',
      objective: 'Una promoción a ready solo se propone cuando todas las dependencias están done y no quedan decisiones humanas pendientes',
      acceptanceCriteria: ['El control no muta la autoridad al proponer la promoción.'],
      dependencies: [],
      decisionsRequired: [],
    },
    {
      id: 'T-SCP',
      title: 'Cambio de alcance de campañas',
      product: 'AI Harness',
      status: 'ready',
      objective: 'Si el alcance crece para incluir escritura de campañas publicitarias ese cambio queda como decisión o supersesión explícita',
      acceptanceCriteria: ['Un cambio de alcance no se aplica por inferencia.'],
      dependencies: [],
      decisionsRequired: [],
    },
    {
      id: 'T-RDY',
      title: 'Candidato de promoción',
      product: 'AI Harness',
      status: 'blocked',
      blockingReason: 'Esperaba T-DEP.',
      objective: 'Promover trabajo ya desbloqueado',
      acceptanceCriteria: ['La promoción es explícita.'],
      dependencies: ['T-DEP'],
      decisionsRequired: [],
    },
  ],
})

const faithfulIntake = () => ({
  schema: 'ai-harness.intake/v1',
  id: 'INT-LONG-COMMERCE-METRICS',
  request: {
    source: 'prompt',
    title: 'Cierre gobernado de checkout y medición',
    body: requestBody,
  },
  need: 'Operar ecommerce y medición como resultados terminables, cada uno con dueño, alcance y gate.',
  statements: [
    {
      id: 'F1',
      kind: 'fact',
      text: 'El control reconstruye vistas generales y por producto desde planning/backlog.json.',
      sourceSpan: 'El control read-only ya reconstruye vistas generales y por producto desde `planning/backlog.json`.',
    },
    {
      id: 'F2',
      kind: 'fact',
      text: 'El lifecycle ya tiene commit local aislado.',
      sourceSpan: 'El árbol Git del harness ya tiene lifecycle con commit local aislado.',
    },
    {
      id: 'A1',
      kind: 'assumption',
      text: 'El IVA uruguayo se calculará después del cierre de checkout.',
      sourceSpan: 'el IVA uruguayo se calculará después del cierre de checkout',
    },
    {
      id: 'Q1',
      kind: 'question',
      text: '¿El medio oficial de cobro del piloto es Mercado Pago, transferencia, o ambos?',
      sourceSpan: '¿El medio oficial de cobro del piloto UruCortinas es Mercado Pago, transferencia bancaria, o ambos',
      answeredBy: 'none',
    },
  ],
  requirements: [
    {
      id: 'R1',
      statement: 'El intake debe conservar cada requisito material de este pedido, incluidos los de checkout y los de medición.',
      material: true,
      product: 'AI Harness',
      cluster: 'harness-intake',
      sourceSpan: 'El intake debe conservar cada requisito material de este pedido, incluidos los de checkout y los de medición.',
      statementIds: ['F1'],
    },
    {
      id: 'R2',
      statement: 'El cierre de checkout ecommerce es un resultado independiente del contrato de métricas y no pueden compartirse en el mismo slice.',
      material: true,
      product: 'AI Harness',
      cluster: 'harness-intake',
      sourceSpan: 'El cierre de checkout ecommerce es un resultado independiente del contrato de métricas y no pueden compartirse en el mismo slice.',
    },
    {
      id: 'R3',
      statement: 'Cada slice debe declarar resultado observable, alcance incluido y excluido, producto dueño y un gate verificable.',
      material: true,
      product: 'AI Harness',
      cluster: 'harness-intake',
      sourceSpan: 'Cada slice debe declarar resultado observable, alcance incluido y excluido, producto dueño y un gate verificable.',
    },
    {
      id: 'R4',
      statement: 'No se debe inferir si el medio oficial de cobro del piloto es Mercado Pago o transferencia bancaria.',
      material: true,
      product: 'commerce-suite',
      cluster: 'payment-decision',
      sourceSpan: 'No se debe inferir si el medio oficial de cobro del piloto es Mercado Pago o transferencia bancaria.',
      statementIds: ['Q1'],
    },
    {
      id: 'R5',
      statement: 'Los slices deben trazarse al backlog canónico en planning/backlog.json y no a una lista paralela.',
      material: true,
      product: 'AI Harness',
      cluster: 'harness-intake',
      sourceSpan: 'Los slices deben trazarse al backlog canónico en planning/backlog.json y no a una lista paralela.',
    },
    {
      id: 'R6',
      statement: 'Una promoción a ready solo se propone cuando todas las dependencias están done y no quedan decisiones humanas pendientes.',
      material: true,
      product: 'AI Harness',
      cluster: 'promotion',
      sourceSpan: 'Una promoción a ready solo se propone cuando todas las dependencias están done y no quedan decisiones humanas pendientes.',
    },
    {
      id: 'R7',
      statement: 'Si el alcance crece para incluir escritura de campañas publicitarias, ese cambio queda como decisión o supersesión explícita.',
      material: true,
      product: 'AI Harness',
      cluster: 'scope-change',
      sourceSpan: 'Si el alcance crece para incluir escritura de campañas publicitarias, ese cambio queda como decisión o supersesión explícita.',
    },
    {
      id: 'R-CHK',
      statement: 'Cerrar el checkout ecommerce del piloto con compra E2E certificada.',
      material: true,
      product: 'commerce-suite',
      cluster: 'checkout',
      sourceSpan: 'la compra E2E con medio de pago real todavía no está certificada para el piloto UruCortinas',
    },
    {
      id: 'R-MET',
      statement: 'Especificar el contrato canónico de eventos y conversión de métricas.',
      material: true,
      product: 'growth-metrics',
      cluster: 'metrics',
      sourceSpan: 'el contrato canónico de eventos todavía no cierra qué cuenta como conversión',
    },
  ],
  slices: [
    {
      id: 'SLC-INTAKE',
      result: 'Conservar cada requisito material del pedido, mantener el cierre de checkout ecommerce como resultado independiente del contrato de métricas, declarar resultado observable alcance producto dueño y gate verificable, y trazar slices al backlog canónico planning/backlog.json sin lista paralela.',
      scope: { in: ['Schema', 'fidelidad', 'trazabilidad'], out: ['Backlog paralelo', 'inferir respuestas'] },
      product: 'AI Harness',
      gate: 'evaluateIntake acepta el pedido extenso y emite diffs semánticos requisito→tarea.',
      requirementIds: ['R1', 'R2', 'R3', 'R5'],
      backlogTaskId: 'T-HAR',
    },
    {
      id: 'SLC-CHECKOUT',
      result: 'Checkout ecommerce del piloto cerrado con compra E2E certificada.',
      scope: { in: ['Checkout', 'compra E2E'], out: ['Contrato de métricas', 'campañas'] },
      product: 'commerce-suite',
      gate: 'Prueba E2E de compra del piloto en sandbox.',
      requirementIds: ['R-CHK'],
      backlogTaskId: 'T-CHK',
      dependsOn: ['SLC-INTAKE'],
    },
    {
      id: 'SLC-METRICS',
      result: 'Contrato canónico de eventos y conversión de métricas especificado.',
      scope: { in: ['Eventos', 'conversión'], out: ['Checkout', 'escritura de campañas'] },
      product: 'growth-metrics',
      gate: 'Contrato revisado contra señales actuales de medición.',
      requirementIds: ['R-MET'],
      backlogTaskId: 'T-MET',
      dependsOn: ['SLC-INTAKE'],
    },
    {
      id: 'SLC-PAYMENT',
      result: 'El medio de cobro queda bloqueado hasta una respuesta humana.',
      scope: { in: ['Pregunta de cobro'], out: ['Elegir Mercado Pago por defecto'] },
      product: 'commerce-suite',
      gate: 'Ninguna implementación de cobro arranca sin decisión humana.',
      requirementIds: ['R4'],
      backlogTaskId: 'T-PAY',
      dependsOn: ['SLC-CHECKOUT'],
    },
    {
      id: 'SLC-PROMOTE',
      result: 'La promoción a ready solo se propone con dependencias done y sin decisiones pendientes.',
      scope: { in: ['Gates de promoción'], out: ['Start automático'] },
      product: 'AI Harness',
      gate: 'promotions no muta autoridades; apply-promotion escribe sin --confirm, --dry-run solo previsualiza y no inicia trabajo.',
      requirementIds: ['R6'],
      backlogTaskId: 'T-PRO',
    },
    {
      id: 'SLC-SCOPE',
      result: 'La escritura de campañas queda como cambio de alcance gobernado.',
      scope: { in: ['Registro de decisión o supersesión'], out: ['Implementar Ads write'] },
      product: 'AI Harness',
      gate: 'El intake rechaza el crecimiento de alcance sin decision o supersession.',
      requirementIds: ['R7'],
      backlogTaskId: 'T-SCP',
    },
  ],
  scopeChanges: [
    {
      kind: 'decision',
      summary: 'Incluir escritura de campañas publicitarias exige una decisión humana explícita; no se agrega al slice de métricas.',
    },
  ],
  fidelity: {
    reviewedAgainstSource: true,
    notes: 'Se conservaron los siete requisitos materiales y los dos resultados de producto sin inferir el medio de cobro.',
  },
})

const makePromotionRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'growth-intake-promote-'))
  mkdirSync(join(dir, 'planning/fragments'), { recursive: true })
  const backlog = syntheticBacklog()
  writeJson(join(dir, 'planning/backlog.json'), backlog)
  writeJson(join(dir, 'planning/fragments/platform.json'), {
    tasks: backlog.tasks.filter(({ product }) => product === 'AI Harness'),
  })
  writeJson(join(dir, 'planning/fragments/ecommerce.json'), { tasks: [] })
  writeJson(join(dir, 'planning/fragments/metrics.json'), { tasks: [] })
  writeJson(join(dir, 'planning/fragments/ai-channels.json'), { tasks: [] })
  return dir
}

test('el pedido extenso declara requisitos materiales extraíbles', () => {
  const lines = extractMaterialLines(requestBody)
  assert.equal(lines.length, 7)
  assert.ok(requestBody.length > 2500)
  assert.ok(coverage(lines[0], faithfulIntake().requirements[0].statement) >= 0.5)
})

test('un intake fiel conserva requisitos, clasifica y traza al backlog canónico', () => {
  const intake = faithfulIntake()
  const backlog = syntheticBacklog()
  const report = evaluateIntake(intake, backlog)

  assert.equal(report.valid, true)
  assert.equal(report.ready, false)
  assert.deepEqual(report.classifications.facts, ['F1', 'F2'])
  assert.deepEqual(report.classifications.assumptions, ['A1'])
  assert.deepEqual(report.classifications.questions, ['Q1'])
  assert.equal(report.classifications.unansweredQuestions.length, 1)
  assert.equal(report.recommendedNextSliceId, 'SLC-INTAKE')
  assert.equal(report.views.general.total, backlog.tasks.length)
  assert.ok(report.views.byProduct['AI Harness'])
  assert.ok(report.views.byProduct['commerce-suite'])
  assert.ok(report.views.byProduct['growth-metrics'])
  assert.equal(report.mutatedAuthority, false)
  assert.equal(report.promotions.started, false)
  assert.deepEqual(report.promotions.candidates.map(({ taskId }) => taskId), ['T-RDY'])
  assert.ok(report.requirementTaskDiffs.every(({ covered }) => covered))
  assert.ok(report.requirementTaskDiffs.some(({ requirementId, backlogTaskId }) =>
    requirementId === 'R-CHK' && backlogTaskId === 'T-CHK'))
})

test('el diff semántico requisito→tarea falla si se pierde cobertura', () => {
  const intake = faithfulIntake()
  const requirement = intake.requirements.find(({ id }) => id === 'R-MET')
  const slice = intake.slices.find(({ id }) => id === 'SLC-METRICS')
  const ok = semanticDiff(requirement, {
    objective: 'Especificar el contrato canónico de eventos y conversión de métricas',
    acceptanceCriteria: ['El contrato de métricas queda escrito.'],
  }, slice)
  const lost = semanticDiff(requirement, {
    objective: 'Cambiar colores del admin',
    acceptanceCriteria: ['El botón es azul.'],
  }, { ...slice, result: 'UI', gate: 'screenshot', scope: { in: ['css'], out: ['datos'] } })

  assert.equal(ok.covered, true)
  assert.equal(lost.covered, false)
  assert.ok(lost.missingTokens.includes('contrato') || lost.missingTokens.includes('metricas'))
})

test('pierde un requisito material del pedido extenso', () => {
  const intake = faithfulIntake()
  intake.requirements = intake.requirements.filter(({ id }) => id !== 'R6')
  intake.slices = intake.slices.filter(({ id }) => id !== 'SLC-PROMOTE')
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'LOST_REQUIREMENT'))
})

test('mezcla checkout y métricas en un slice independiente', () => {
  const intake = faithfulIntake()
  const checkout = intake.slices.find(({ id }) => id === 'SLC-CHECKOUT')
  checkout.requirementIds = ['R-CHK', 'R-MET']
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'MIXED_REQUIREMENTS'))
})

test('rechaza inferir la respuesta humana del medio de cobro', () => {
  const intake = faithfulIntake()
  const question = intake.statements.find(({ id }) => id === 'Q1')
  question.answer = 'Mercado Pago, porque es lo más común en el código legado.'
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'INFERRED_HUMAN_ANSWER'))
})

test('rechaza un backlog paralelo como autoridad', () => {
  const intake = faithfulIntake()
  intake.tasks = [{ id: 'SHADOW-001', title: 'Cola paralela' }]
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'PARALLEL_BACKLOG'))
})

test('un cambio de alcance sin decisión ni supersesión falla', () => {
  const intake = faithfulIntake()
  intake.scopeChanges = [{ kind: 'note', summary: 'También hacemos Ads write.' }]
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'INVALID_SCOPE_CHANGE'))
})

test('una pregunta humana respondida no se considera inferida', () => {
  const intake = faithfulIntake()
  const question = intake.statements.find(({ id }) => id === 'Q1')
  question.answeredBy = 'human'
  question.answer = 'Ambos, con Mercado Pago como default y transferencia para mayoristas.'
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, true)
  assert.equal(report.ready, true)
  assert.equal(report.classifications.unansweredQuestions.length, 0)
})

test('promotions no muta la autoridad y apply-promotion escribe sin iniciar trabajo', () => {
  const dir = makePromotionRepo()
  const bytesBefore = readFileSync(join(dir, 'planning/backlog.json'), 'utf8')
  const chunks = []
  runIntakeCli(['promotions'], { root: dir, stdout: { write: (chunk) => chunks.push(chunk) } })
  const proposal = JSON.parse(chunks.join(''))

  assert.deepEqual(proposal.candidates.map(({ taskId }) => taskId), ['T-RDY'])
  assert.equal(proposal.mutatedAuthority, false)
  assert.equal(readFileSync(join(dir, 'planning/backlog.json'), 'utf8'), bytesBefore)

  const dryRun = applyPromotion(dir, 'T-RDY', { dryRun: true })
  assert.equal(dryRun.applied, false)
  assert.equal(readFileSync(join(dir, 'planning/backlog.json'), 'utf8'), bytesBefore)

  const previewChunks = []
  runIntakeCli(['apply-promotion', '--id', 'T-RDY', '--dry-run'], {
    root: dir,
    stdout: { write: (chunk) => previewChunks.push(chunk) },
  })
  const preview = JSON.parse(previewChunks.join(''))
  assert.equal(preview.applied, false)
  assert.equal(readFileSync(join(dir, 'planning/backlog.json'), 'utf8'), bytesBefore)

  assert.throws(() => applyPromotion(dir, 'T-RDY', { start: true }), {
    code: 'PROMOTION_MUST_NOT_START',
  })
  assert.throws(() => applyPromotion(dir, 'T-PAY'), {
    code: 'PROMOTION_NOT_ELIGIBLE',
  })

  const applied = applyPromotion(dir, 'T-RDY')
  assert.equal(applied.applied, true)
  assert.equal(applied.started, false)
  assert.equal(applied.actor, 'harness')
  const backlog = JSON.parse(readFileSync(join(dir, 'planning/backlog.json'), 'utf8'))
  const fragment = JSON.parse(readFileSync(join(dir, 'planning/fragments/platform.json'), 'utf8'))
  assert.equal(backlog.tasks.find(({ id }) => id === 'T-RDY').status, 'ready')
  assert.equal(fragment.tasks.find(({ id }) => id === 'T-RDY').status, 'ready')
  rmSync(dir, { recursive: true, force: true })
})

test('apply-promotion --eligible escribe todos los candidatos y --start permanece prohibido', () => {
  const dir = makePromotionRepo()
  const bytesBefore = readFileSync(join(dir, 'planning/backlog.json'), 'utf8')

  const preview = applyEligiblePromotions(dir, { dryRun: true })
  assert.deepEqual(preview.candidates.map(({ taskId }) => taskId), ['T-RDY'])
  assert.equal(preview.applied, false)
  assert.equal(readFileSync(join(dir, 'planning/backlog.json'), 'utf8'), bytesBefore)

  assert.throws(() => applyEligiblePromotions(dir, { start: true }), {
    code: 'PROMOTION_MUST_NOT_START',
  })

  const applied = applyEligiblePromotions(dir)
  assert.equal(applied.applied, true)
  assert.deepEqual(applied.appliedIds, ['T-RDY'])
  assert.equal(applied.started, false)
  assert.equal(applied.actor, 'harness')
  const backlog = JSON.parse(readFileSync(join(dir, 'planning/backlog.json'), 'utf8'))
  assert.equal(backlog.tasks.find(({ id }) => id === 'T-RDY').status, 'ready')
  assert.equal(backlog.tasks.find(({ id }) => id === 'T-PAY').status, 'blocked')
  rmSync(dir, { recursive: true, force: true })
})

test('el intake no muta el backlog canónico al evaluar promociones', () => {
  const backlog = syntheticBacklog()
  const before = JSON.stringify(backlog)
  const report = evaluateIntake(faithfulIntake(), backlog)

  assert.equal(JSON.stringify(backlog), before)
  assert.deepEqual(report.promotions.candidates.map(({ taskId }) => taskId), ['T-RDY'])
  assert.equal(report.promotions.applied, false)
  assert.equal(report.mutatedAuthority, false)
})

test('el CLI evaluate falla cerrado ante mezcla de requisitos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'growth-intake-cli-'))
  mkdirSync(join(dir, 'planning'), { recursive: true })
  const intake = faithfulIntake()
  intake.slices.find(({ id }) => id === 'SLC-CHECKOUT').requirementIds = ['R-CHK', 'R-MET']
  const file = join(dir, 'intake.json')
  writeJson(file, intake)
  writeJson(join(dir, 'planning/backlog.json'), syntheticBacklog())
  const chunks = []
  const previous = process.exitCode
  process.exitCode = 0
  runIntakeCli(['--file', file, '--backlog', join(dir, 'planning/backlog.json')], {
    root: dir,
    stdout: { write: (chunk) => chunks.push(chunk) },
  })
  const report = JSON.parse(chunks.join(''))
  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'MIXED_REQUIREMENTS'))
  assert.equal(process.exitCode, 1)
  process.exitCode = previous
  rmSync(dir, { recursive: true, force: true })
})

test('un requisito material sin slice se declara perdido', () => {
  const intake = faithfulIntake()
  intake.slices = intake.slices.filter(({ id }) => id !== 'SLC-SCOPE')
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code, message }) =>
    code === 'LOST_REQUIREMENT' && message.includes('R7')))
})

test('el mismo requisito en dos slices independientes se declara mezclado', () => {
  const intake = faithfulIntake()
  intake.slices.find(({ id }) => id === 'SLC-METRICS').requirementIds = ['R-MET', 'R-CHK']
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'MIXED_REQUIREMENTS'))
})

test('evaluate emite SEMANTIC_GAP si la tarea canónica no cubre el requisito', () => {
  const intake = faithfulIntake()
  const backlog = syntheticBacklog()
  const task = backlog.tasks.find(({ id }) => id === 'T-MET')
  task.title = 'UI'
  task.objective = 'Cambiar colores del admin'
  task.acceptanceCriteria = ['El botón es azul.']
  const slice = intake.slices.find(({ id }) => id === 'SLC-METRICS')
  slice.result = 'UI del admin'
  slice.gate = 'screenshot'
  slice.scope = { in: ['css'], out: ['datos'] }
  const report = evaluateIntake(intake, backlog)

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code, message }) =>
    code === 'SEMANTIC_GAP' && message.includes('R-MET')))
})

test('una supersesión sin DEC-xxx falla', () => {
  const intake = faithfulIntake()
  intake.scopeChanges = [{ kind: 'supersession', summary: 'También hacemos Ads write.' }]
  const report = evaluateIntake(intake, syntheticBacklog())

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === 'INVALID_SCOPE_CHANGE'))
})

test('el fixture extenso satisface el schema de intake', () => {
  const schema = JSON.parse(readFileSync(join(root, 'ai-harness/schemas/intake.schema.json'), 'utf8'))
  const intake = faithfulIntake()

  assert.equal(intake.schema, schema.properties.schema.const)
  for (const key of schema.required) assert.ok(Object.hasOwn(intake, key), `falta ${key}`)
  for (const requirement of intake.requirements) {
    for (const key of schema.$defs.requirement.required) {
      assert.ok(Object.hasOwn(requirement, key), `requirement ${requirement.id} falta ${key}`)
    }
  }
  for (const slice of intake.slices) {
    for (const key of schema.$defs.slice.required) {
      assert.ok(Object.hasOwn(slice, key), `slice ${slice.id} falta ${key}`)
    }
    assert.ok(slice.scope.in.length >= 1)
    assert.ok(slice.scope.out.length >= 1)
    assert.ok(slice.gate.trim())
    assert.ok(slice.product.trim())
  }
})

test('recomienda el slice habilitador desbloqueado aunque un dependiente aparezca primero', () => {
  const intake = faithfulIntake()
  intake.slices = [
    intake.slices.find(({ id }) => id === 'SLC-CHECKOUT'),
    intake.slices.find(({ id }) => id === 'SLC-METRICS'),
    ...intake.slices.filter(({ id }) => !['SLC-CHECKOUT', 'SLC-METRICS'].includes(id)),
  ]
  const backlog = syntheticBacklog()
  const report = evaluateIntake(intake, backlog)
  const next = recommendedNextSlice(intake, new Map(backlog.tasks.map((task) => [task.id, task])))

  assert.equal(report.recommendedNextSliceId, 'SLC-INTAKE')
  assert.equal(next.id, 'SLC-INTAKE')
})

test('si el slice habilitador ya está done, recomienda el siguiente frente terminable', () => {
  const intake = faithfulIntake()
  const backlog = syntheticBacklog()
  backlog.tasks.find(({ id }) => id === 'T-HAR').status = 'done'
  const report = evaluateIntake(intake, backlog)

  assert.equal(report.recommendedNextSliceId, 'SLC-CHECKOUT')
})
