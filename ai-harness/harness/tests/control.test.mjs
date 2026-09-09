import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildControlReport, renderAuditorResponse, validateAuditorResponse } from '../control.mjs'

const root = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))

const makeFixture = () => {
  const fixture = mkdtempSync(join(tmpdir(), 'growth-harness-control-'))
  const copyPaths = new Set([
    'AGENTS.md',
    'ai-harness/VERSION',
    'ai-harness/config/project.json',
    'planning/backlog.json',
    'ai-harness-local/decisions/index.json',
    'ai-harness-local/feature_list.json',
    'ai-harness-local/progress/current.json',
    'ai-harness-local/control/capabilities.json',
    'ai-harness-local/control/requirements.json',
    'ai-harness-local/control/policy.json',
    'ai-harness-local/control/auditor-task.json',
    'ai-harness-local/control/response-contract.json',
    'ai-harness-local/control/chat-auditor-prompt.md',
    'ai-harness-local/control/auditor-response-template.md',
  ])
  const config = JSON.parse(readFileSync(join(root, 'ai-harness/config/project.json'), 'utf8'))
  const capabilities = JSON.parse(readFileSync(join(root, 'ai-harness-local/control/capabilities.json'), 'utf8'))
  const requirements = JSON.parse(readFileSync(join(root, 'ai-harness-local/control/requirements.json'), 'utf8'))
  for (const path of config.canonicalDocs ?? []) copyPaths.add(path)
  for (const capability of capabilities.capabilities ?? []) {
    for (const path of capability.evidence ?? []) copyPaths.add(path)
  }
  for (const requirement of requirements.requirements ?? []) {
    for (const path of requirement.sourceRefs ?? []) copyPaths.add(path)
  }
  for (const path of copyPaths) {
    const destination = join(fixture, path)
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(join(root, path), destination, { recursive: true })
  }
  execFileSync('git', ['init', '-q'], { cwd: fixture })
  execFileSync('git', ['config', 'user.name', 'Harness Test'], { cwd: fixture })
  execFileSync('git', ['config', 'user.email', 'harness@example.invalid'], { cwd: fixture })
  execFileSync('git', ['add', '.'], { cwd: fixture })
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: fixture })
  return fixture
}

test('reconstruye el estado y conserva la paridad como no alcanzada', () => {
  const report = buildControlReport(root)

  assert.equal(report.validation, 'OK')
  assert.equal(report.alignment.status, 'ALIGNED')
  assert.equal(report.facts.harness.parityAchieved, false)
  assert.equal(report.facts.requirements.total, 9)
  assert.ok(report.facts.backlog.byProduct['AI Harness'])
  assert.ok(report.recommendation.taskId)
  assert.equal(report.recommendation.action, report.facts.backlog.inProgressIds.length ? 'CONTINUE' : 'START')
})

test('detecta un bloqueo obsoleto y deriva la promoción sin mutar la autoridad', (t) => {
  const fixture = makeFixture()
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const backlogPath = join(fixture, 'planning/backlog.json')
  const backlog = JSON.parse(readFileSync(backlogPath, 'utf8'))
  const task = backlog.tasks.find(({ id }) => id === 'HAR-003')
  task.status = 'blocked'
  task.blockingReason = 'Fixture: espera una dependencia ya terminada.'
  writeFileSync(backlogPath, `${JSON.stringify(backlog, null, 2)}\n`)
  const bytesBefore = readFileSync(backlogPath, 'utf8')

  const report = buildControlReport(fixture)

  assert.equal(report.validation, 'OK')
  assert.deepEqual(report.facts.backlog.promotionCandidates.map(({ taskId }) => taskId), ['HAR-003'])
  assert.equal(report.recommendation.action, 'PROMOTE')
  assert.equal(report.recommendation.taskId, 'HAR-003')
  assert.equal(report.recommendation.handoff.destination, 'NONE')
  assert.equal(report.recommendation.prompt, null)
  const contract = JSON.parse(readFileSync(join(fixture, 'ai-harness-local/control/response-contract.json'), 'utf8'))
  const content = renderAuditorResponse(report, contract)
  assert.ok(!content.includes('- Prompt exacto para copiar:'))
  assert.deepEqual(validateAuditorResponse(content, contract, { expectedRecommendation: report.recommendation }), [])
  assert.equal(readFileSync(backlogPath, 'utf8'), bytesBefore)
})

test('una decisión pendiente impide la promoción derivada', (t) => {
  const fixture = makeFixture()
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const backlogPath = join(fixture, 'planning/backlog.json')
  const backlog = JSON.parse(readFileSync(backlogPath, 'utf8'))
  const task = backlog.tasks.find(({ id }) => id === 'HAR-003')
  task.status = 'blocked'
  task.blockingReason = 'Fixture: requiere decisión humana.'
  task.decisionsRequired = ['Confirmar el alcance del intake.']
  writeFileSync(backlogPath, `${JSON.stringify(backlog, null, 2)}\n`)

  const report = buildControlReport(fixture)

  assert.equal(report.validation, 'OK')
  assert.ok(!report.facts.backlog.promotionCandidates.some(({ taskId }) => taskId === 'HAR-003'))
  assert.notEqual(report.recommendation.taskId, 'HAR-003')
  assert.ok(report.humanDecisions.pendingCount > 0)
})

test('el orden gobernado recomienda HAR-003 antes que otros ready aunque el backlog esté ordenado por id', () => {
  const backlog = JSON.parse(readFileSync(join(root, 'planning/backlog.json'), 'utf8'))
  const report = buildControlReport(root)
  const harIndex = backlog.tasks.findIndex(({ id }) => id === 'HAR-003')
  const ecIndex = backlog.tasks.findIndex(({ id }) => id === 'EC-001')

  assert.ok(ecIndex < harIndex)
  assert.equal(report.recommendation.action, 'START')
  assert.equal(report.recommendation.taskId, 'HAR-003')
  assert.deepEqual(report.facts.backlog.promotionCandidates, [])
})

test('el prompt recomendado queda enlazado al fingerprint vigente', () => {
  const report = buildControlReport(root)

  assert.ok(report.recommendation.prompt.content.includes(report.recommendation.taskId))
  assert.equal(report.recommendation.prompt.sourcesFingerprint, report.facts.harness.sourcesFingerprint)
  assert.match(report.recommendation.prompt.contentSha256, /^[0-9a-f]{64}$/u)
})

test('genera la respuesta auditora con seis secciones obligatorias y una única recomendación', () => {
  const report = buildControlReport(root)
  const contract = JSON.parse(readFileSync(join(root, 'ai-harness-local/control/response-contract.json'), 'utf8'))
  const content = renderAuditorResponse(report, contract)

  assert.deepEqual(validateAuditorResponse(content, contract, { expectedRecommendation: report.recommendation }), [])
  assert.ok(contract.sections.every(({ heading }) => content.includes(`${heading}\n`)))
  assert.equal((content.match(/^- Tarea:/gmu) ?? []).length, 1)
  assert.ok(content.includes(`- Destino: **${report.recommendation.handoff.destination}**.`))
  assert.ok(content.includes(`\`\`\`text\n${report.recommendation.prompt.content}\`\`\``))
  assert.ok(content.includes(report.recommendation.taskId))
})

test('el validador rechaza secciones ausentes, duplicadas, vacías o sin resultado único', () => {
  const contract = JSON.parse(readFileSync(join(root, 'ai-harness-local/control/response-contract.json'), 'utf8'))
  const valid = renderAuditorResponse(buildControlReport(root), contract)
  const missing = valid.replace(`${contract.sections[2].heading}\n`, '')
  const duplicate = valid.replace(contract.sections[2].heading, `${contract.sections[2].heading}\n${contract.sections[2].heading}`)
  const emptyStart = valid.indexOf(contract.sections[2].heading) + contract.sections[2].heading.length
  const emptyEnd = valid.indexOf(contract.sections[3].heading)
  const empty = `${valid.slice(0, emptyStart)}\n\n${valid.slice(emptyEnd)}`
  const ambiguous = valid.replace('- Tarea:', '- **Recomendación bloqueada** placeholder\n- Tarea:')
  const additional = valid.replace(contract.sections[3].heading, `## Sección no permitida\n\n- Extra.\n\n${contract.sections[3].heading}`)
  const report = buildControlReport(root)
  const actualDestination = report.recommendation.handoff.destination
  const wrongDestinationValue = actualDestination === 'NEW_CHAT' ? 'CONTINUE_EXISTING_TASK' : 'NEW_CHAT'
  const wrongDestination = valid.replace(`**${actualDestination}**`, `**${wrongDestinationValue}**`)
  const changedPrompt = valid.replaceAll(report.recommendation.objective, `${report.recommendation.objective} alterado`)

  assert.ok(validateAuditorResponse(missing, contract).length > 0)
  assert.ok(validateAuditorResponse(duplicate, contract).length > 0)
  assert.ok(validateAuditorResponse(empty, contract).length > 0)
  assert.ok(validateAuditorResponse(ambiguous, contract).length > 0)
  assert.ok(validateAuditorResponse(additional, contract).length > 0)
  assert.ok(validateAuditorResponse(wrongDestination, contract, { expectedRecommendation: report.recommendation }).length > 0)
  assert.ok(validateAuditorResponse(changedPrompt, contract, { expectedRecommendation: report.recommendation }).length > 0)
})

test('el handoff distingue nuevo chat, continuidad y bloqueo sin ejecutar en el auditor', () => {
  const contract = JSON.parse(readFileSync(join(root, 'ai-harness-local/control/response-contract.json'), 'utf8'))
  const startReport = buildControlReport(root)
  const continueReport = structuredClone(startReport)
  continueReport.recommendation.action = 'CONTINUE'
  continueReport.recommendation.handoff = {
    destination: 'CONTINUE_EXISTING_TASK',
    sessionId: 'feature-example',
  }
  const continueContent = renderAuditorResponse(continueReport, contract)
  assert.ok(continueContent.includes('- Destino: **CONTINUE_EXISTING_TASK**.'))
  assert.ok(continueContent.includes('`feature-example`'))
  assert.deepEqual(
    validateAuditorResponse(continueContent, contract, { expectedRecommendation: continueReport.recommendation }),
    [],
  )

  const blockedReport = structuredClone(startReport)
  blockedReport.validation = 'FAIL'
  blockedReport.freshness = 'UNVERIFIABLE'
  blockedReport.recommendation = null
  const blockedContent = renderAuditorResponse(blockedReport, contract)
  assert.ok(blockedContent.includes('- Destino: **NONE**.'))
  assert.ok(!blockedContent.includes('- Prompt exacto para copiar:'))
  assert.deepEqual(validateAuditorResponse(blockedContent, contract, { expectedRecommendation: null }), [])
})

test('los guardrails estratégicos conservan caminos de dependencias', () => {
  const report = buildControlReport(root)
  const strategicChecks = report.alignment.checks.filter(({ id }) => id.startsWith('ALIGN-') && id !== 'ALIGN-DISCOVERY-FIRST' && id !== 'ALIGN-REQUIREMENTS')

  assert.ok(strategicChecks.length >= 6)
  assert.ok(strategicChecks.every(({ status }) => status === 'PASS'))
})

test('falla cerrado cuando falta una autoridad', (t) => {
  const fixture = makeFixture()
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  rmSync(join(fixture, 'planning/backlog.json'))

  const report = buildControlReport(fixture)

  assert.equal(report.validation, 'FAIL')
  assert.equal(report.freshness, 'UNVERIFIABLE')
  assert.equal(report.recommendation, null)
  assert.ok(report.discrepancies.some(({ kind }) => kind === 'MISSING_AUTHORITY'))
})

test('bloquea la recomendación si se rompe un guardrail estratégico', (t) => {
  const fixture = makeFixture()
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const policyPath = join(fixture, 'ai-harness-local/control/policy.json')
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'))
  policy.requiredPredecessors[0].mustReach.push('MISSING-999')
  writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`)

  const report = buildControlReport(fixture)

  assert.equal(report.validation, 'OK')
  assert.equal(report.alignment.status, 'DRIFT')
  assert.equal(report.recommendation, null)
})

test('falla cerrado mientras la tarea auditora siga en setup_pending', (t) => {
  const fixture = makeFixture()
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const auditorPath = join(fixture, 'ai-harness-local/control/auditor-task.json')
  const auditor = JSON.parse(readFileSync(auditorPath, 'utf8'))
  auditor.creation = {
    status: 'setup_pending',
    clientThreadId: 'client-new-thread:pending',
    hostId: 'local',
  }
  writeFileSync(auditorPath, `${JSON.stringify(auditor, null, 2)}\n`)

  const report = buildControlReport(fixture)

  assert.equal(report.validation, 'FAIL')
  assert.equal(report.freshness, 'UNVERIFIABLE')
  assert.equal(report.recommendation, null)
  assert.ok(report.discrepancies.some(({ kind }) => kind === 'AUDITOR_TASK_NOT_READY'))
})

test('no recomienda START mientras existe un cierre pendiente de consolidación', (t) => {
  const fixture = makeFixture()
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: fixture, encoding: 'utf8' }).trim()
  writeFileSync(join(gitDir, 'ai-harness-lifecycle-transaction.json'), '{}\n')

  const report = buildControlReport(fixture)

  assert.equal(report.validation, 'FAIL')
  assert.equal(report.recommendation, null)
  assert.ok(report.discrepancies.some(({ kind }) => kind === 'LIFECYCLE_RECOVERY_REQUIRED'))
})

test('falla cerrado si la plantilla no satisface el contrato de seis secciones', (t) => {
  const fixture = makeFixture()
  t.after(() => rmSync(fixture, { recursive: true, force: true }))
  const templatePath = join(fixture, 'ai-harness-local/control/auditor-response-template.md')
  const template = readFileSync(templatePath, 'utf8').replace('## 4. Desvíos, evidencia faltante y sobredeclaraciones', '')
  writeFileSync(templatePath, template)

  const report = buildControlReport(fixture)

  assert.equal(report.validation, 'FAIL')
  assert.equal(report.recommendation, null)
  assert.ok(report.discrepancies.some(({ kind }) => kind === 'INVALID_AUDITOR_RESPONSE_CONTRACT'))
})
