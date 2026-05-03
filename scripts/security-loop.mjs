#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const SECURITY_DIR = path.join(ROOT_DIR, 'security')
const REPORT_PATH = path.join(SECURITY_DIR, 'latest-report.json')
const BASELINE_PATH = path.join(SECURITY_DIR, 'baseline.json')
const LOG_PATH = path.join(SECURITY_DIR, 'vulnerability-log.json')
const ACCEPTED_RISKS_PATH = path.join(SECURITY_DIR, 'accepted-risks.json')
const DEFAULT_MAX_ITERATIONS = 3

const PROJECTS = {
  frontend: {
    name: 'frontend',
    cwd: path.join(ROOT_DIR, 'frontend'),
    packageJsonPath: path.join(ROOT_DIR, 'frontend', 'package.json'),
    packageLockPath: path.join(ROOT_DIR, 'frontend', 'package-lock.json'),
    buildCommand: ['npm', 'run', 'build'],
  },
  backend: {
    name: 'backend',
    cwd: path.join(ROOT_DIR, 'backend'),
    packageJsonPath: path.join(ROOT_DIR, 'backend', 'package.json'),
    packageLockPath: path.join(ROOT_DIR, 'backend', 'package-lock.json'),
    buildCommand: ['npm', 'run', 'build'],
  },
}

function parseArgs(argv) {
  const [command = 'scan', ...rest] = argv
  const options = { command, allowForce: false, maxIterations: DEFAULT_MAX_ITERATIONS }

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (token === '--project') {
      options.project = rest[index + 1]
      index += 1
      continue
    }
    if (token === '--phase') {
      options.phase = rest[index + 1]
      index += 1
      continue
    }
    if (token === '--allow-force') {
      options.allowForce = true
      continue
    }
    if (token === '--max-iterations') {
      options.maxIterations = Number(rest[index + 1] || DEFAULT_MAX_ITERATIONS)
      index += 1
    }
  }

  return options
}

function resolveProjects(projectName) {
  if (!projectName) {
    return Object.values(PROJECTS)
  }

  const project = PROJECTS[projectName]
  if (!project) {
    throw new Error(`Unknown project "${projectName}"`)
  }
  return [project]
}

function makeVulnerabilityKey(projectName, vulnerability) {
  return `${projectName}:${vulnerability.name}`
}

function classifyImpact(severity, runtime) {
  if (severity === 'critical') {
    return 'critical-blocking'
  }
  if (severity === 'high') {
    return runtime ? 'high-runtime-blocking' : 'high-dev-blocking'
  }
  if (severity === 'moderate') {
    return runtime ? 'moderate-runtime' : 'moderate-dev'
  }
  return runtime ? 'low-runtime' : 'low-dev'
}

function dependencyType(vulnerability) {
  return vulnerability.isDirect ? 'direct' : 'transitive'
}

function readJsonSafe(contents, fallback, sourceLabel) {
  try {
    return JSON.parse(contents)
  } catch (error) {
    throw new Error(`Failed to parse ${sourceLabel}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function readJsonFile(filePath, fallback) {
  try {
    const contents = await readFile(filePath, 'utf8')
    return readJsonSafe(contents, fallback, filePath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return fallback
    }
    throw error
  }
}

async function runCommand(command, args, cwd, options = {}) {
  const { allowFailure = false, streamOutput = true } = options
  const prefix = `[security] ${path.relative(ROOT_DIR, cwd) || '.'} $ ${command} ${args.join(' ')}`
  console.log(prefix)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      if (streamOutput) {
        process.stdout.write(text)
      }
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      if (streamOutput) {
        process.stderr.write(text)
      }
    })

    child.on('error', reject)
    child.on('close', (code) => {
      const result = { code: code ?? 1, stdout, stderr }
      if (!allowFailure && result.code !== 0) {
        reject(new Error(`Command failed (${result.code}): ${command} ${args.join(' ')}`))
        return
      }
      resolve(result)
    })
  })
}

function lockfileNodeIsRuntime(lockfile, nodePath) {
  const packages = lockfile?.packages ?? {}
  const pkg = packages[nodePath]
  if (!pkg) {
    return true
  }
  return pkg.dev !== true
}

function resolveExposure(vulnerability, manifest, lockfile) {
  const directDependencyType = manifest.dependencies?.[vulnerability.name]
    ? 'runtime'
    : manifest.devDependencies?.[vulnerability.name]
      ? 'development'
      : null

  if (directDependencyType) {
    return directDependencyType
  }

  const nodes = vulnerability.nodes ?? []
  if (nodes.length === 0) {
    return 'runtime'
  }

  const runtimeNode = nodes.find((nodePath) => lockfileNodeIsRuntime(lockfile, nodePath))
  return runtimeNode ? 'runtime' : 'development'
}

function advisoryTitles(vulnerability) {
  return (vulnerability.via ?? []).map((entry) => {
    if (typeof entry === 'string') {
      return entry
    }
    return entry.title || entry.name || String(entry.source)
  })
}

function acceptedRiskFor(risks, projectName, packageName) {
  return (risks?.risks ?? []).find(
    (risk) => risk.project === projectName && risk.package === packageName,
  )
}

function summarizeProjectVulnerabilities(projectName, audit, manifest, lockfile, acceptedRisks) {
  const vulnerabilities = Object.values(audit.vulnerabilities ?? {})
    .map((entry) => {
      const exposure = resolveExposure(entry, manifest, lockfile)
      const acceptedRisk = acceptedRiskFor(acceptedRisks, projectName, entry.name)
      const severity = entry.severity
      const key = makeVulnerabilityKey(projectName, entry)
      const fixAvailable = entry.fixAvailable === true
        ? { available: true, mode: 'safe' }
        : entry.fixAvailable
          ? { available: true, mode: entry.fixAvailable.isSemVerMajor ? 'major' : 'safe', target: entry.fixAvailable }
          : { available: false, mode: 'none' }
      const status = acceptedRisk ? 'accepted' : 'open'

      return {
        key,
        project: projectName,
        dependency: entry.name,
        severity,
        impact: classifyImpact(severity, exposure === 'runtime'),
        type: dependencyType(entry),
        exposure,
        status,
        acceptedRisk,
        fixAvailable,
        paths: entry.nodes ?? [],
        advisoryTitles: advisoryTitles(entry),
      }
    })
    .sort((left, right) => {
      const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1 }
      return (severityOrder[right.severity] || 0) - (severityOrder[left.severity] || 0)
    })

  const blocking = vulnerabilities.filter(
    (entry) => ['critical', 'high'].includes(entry.severity),
  )
  const acceptedModerate = vulnerabilities.filter(
    (entry) => entry.severity === 'moderate' && entry.status === 'accepted',
  )
  const unresolvedModerate = vulnerabilities.filter(
    (entry) => entry.severity === 'moderate' && entry.status !== 'accepted',
  )

  return {
    name: projectName,
    cwd: PROJECTS[projectName].cwd,
    lockfileHash: lockfileHash(lockfile),
    metadata: audit.metadata ?? {},
    vulnerabilities,
    blocking,
    acceptedModerate,
    unresolvedModerate,
  }
}

function lockfileHash(lockfile) {
  return createHash('sha256').update(JSON.stringify(lockfile)).digest('hex')
}

async function runAuditForProject(project, acceptedRisks) {
  await runCommand('npm', ['audit'], project.cwd, { allowFailure: true })
  const jsonAudit = await runCommand('npm', ['audit', '--json'], project.cwd, {
    allowFailure: true,
    streamOutput: false,
  })
  const audit = readJsonSafe(jsonAudit.stdout, {}, `${project.name} npm audit --json`)
  const manifest = await readJsonFile(project.packageJsonPath, {})
  const lockfile = await readJsonFile(project.packageLockPath, {})

  return summarizeProjectVulnerabilities(project.name, audit, manifest, lockfile, acceptedRisks)
}

function flattenReport(report) {
  return report.projects.flatMap((project) => project.vulnerabilities)
}

function blockingCount(report) {
  return report.projects.reduce((total, project) => total + project.blocking.length, 0)
}

function unresolvedModerateCount(report) {
  return report.projects.reduce((total, project) => total + project.unresolvedModerate.length, 0)
}

async function writeArtifacts(report) {
  await mkdir(SECURITY_DIR, { recursive: true })

  const previousLog = await readJsonFile(LOG_PATH, [])
  const previousByKey = new Map(previousLog.map((entry) => [entry.key, entry]))
  const currentEntries = flattenReport(report)
  const currentKeys = new Set(currentEntries.map((entry) => entry.key))
  const now = report.generatedAt
  const nextLog = []

  for (const entry of currentEntries) {
    const previous = previousByKey.get(entry.key)
    nextLog.push({
      key: entry.key,
      project: entry.project,
      dependency: entry.dependency,
      severity: entry.severity,
      type: entry.type,
      exposure: entry.exposure,
      status: entry.status,
      action: entry.status === 'accepted' ? 'accepted risk tracked' : 'open in latest audit',
      advisories: entry.advisoryTitles,
      firstSeenAt: previous?.firstSeenAt ?? now,
      lastSeenAt: now,
      updatedAt: now,
    })
  }

  for (const previous of previousLog) {
    if (currentKeys.has(previous.key)) {
      continue
    }
    nextLog.push({
      ...previous,
      status: 'fixed',
      action: 'not present in latest audit',
      updatedAt: now,
    })
  }

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(LOG_PATH, `${JSON.stringify(nextLog, null, 2)}\n`)
}

async function writeBaseline(report) {
  await mkdir(SECURITY_DIR, { recursive: true })
  const baseline = {
    generatedAt: report.generatedAt,
    projects: report.projects.map((project) => ({
      name: project.name,
      lockfileHash: project.lockfileHash,
      vulnerabilityKeys: project.vulnerabilities.map((entry) => entry.key),
      blockingKeys: project.blocking.map((entry) => entry.key),
      acceptedKeys: project.vulnerabilities
        .filter((entry) => entry.status === 'accepted')
        .map((entry) => entry.key),
    })),
  }
  await writeFile(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`)
}

function printSummary(report) {
  console.log(`[security] report written to ${path.relative(ROOT_DIR, REPORT_PATH)}`)
  for (const project of report.projects) {
    const counts = project.metadata.vulnerabilities ?? {}
    console.log(
      `[security] ${project.name}: critical=${counts.critical ?? 0} high=${counts.high ?? 0} moderate=${counts.moderate ?? 0} low=${counts.low ?? 0}`,
    )
  }
}

async function generateReport(projectName) {
  const projects = resolveProjects(projectName)
  const acceptedRisks = await readJsonFile(ACCEPTED_RISKS_PATH, { risks: [] })
  const generatedAt = new Date().toISOString()
  const projectReports = []

  for (const project of projects) {
    projectReports.push(await runAuditForProject(project, acceptedRisks))
  }

  return {
    generatedAt,
    projects: projectReports,
  }
}

function missingAcceptedModerates(report) {
  return flattenReport(report).filter(
    (entry) => entry.severity === 'moderate' && entry.status !== 'accepted',
  )
}

async function runBuilds(projects) {
  for (const project of projects) {
    const [command, ...args] = project.buildCommand
    await runCommand(command, args, project.cwd)
  }
}

async function validateLocalTestStack() {
  await runCommand('make', ['local-test-reset'], ROOT_DIR)
}

async function runLoop(options) {
  const projects = resolveProjects(options.project)

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    console.log(`[security] loop iteration ${iteration}/${options.maxIterations}`)
    await runBuilds(projects)
    await validateLocalTestStack()

    const report = await generateReport(options.project)
    await writeArtifacts(report)
    printSummary(report)

    if (blockingCount(report) === 0 && unresolvedModerateCount(report) === 0) {
      await writeBaseline(report)
      console.log('[security] loop finished without blocking vulnerabilities')
      return
    }

    const projectNamesWithBlocking = report.projects
      .filter((project) => project.blocking.length > 0)
      .map((project) => project.name)

    if (projectNamesWithBlocking.length === 0) {
      throw new Error(
        `Moderate vulnerabilities remain without accepted risk: ${missingAcceptedModerates(report)
          .map((entry) => `${entry.project}:${entry.dependency}`)
          .join(', ')}`,
      )
    }

    let changed = false
    for (const projectName of projectNamesWithBlocking) {
      const project = PROJECTS[projectName]
      const result = await runCommand('npm', ['audit', 'fix'], project.cwd, {
        allowFailure: true,
      })
      changed =
        changed ||
        /changed \d+ package/i.test(result.stdout) ||
        /added \d+ packages/i.test(result.stdout) ||
        /removed \d+ packages/i.test(result.stdout)
    }

    if (!changed && options.allowForce) {
      for (const projectName of projectNamesWithBlocking) {
        const project = PROJECTS[projectName]
        await runCommand('npm', ['audit', 'fix', '--force'], project.cwd, {
          allowFailure: true,
        })
      }
      continue
    }

    if (!changed) {
      throw new Error('Security loop requires manual remediation for remaining blocking vulnerabilities.')
    }
  }

  throw new Error('Security loop exhausted max iterations before reaching an acceptable security state.')
}

function compareWithBaseline(report, baseline) {
  const project = report.projects[0]
  const baselineProject = baseline?.projects?.find((entry) => entry.name === project.name)
  const currentBlocking = project.blocking.map((entry) => entry.key)

  if (currentBlocking.length > 0) {
    return {
      ok: false,
      reason: `blocking vulnerabilities detected: ${project.blocking
        .map((entry) => `${entry.dependency}(${entry.severity})`)
        .join(', ')}`,
    }
  }

  if (project.unresolvedModerate.length > 0) {
    return {
      ok: false,
      reason: `moderate vulnerabilities require justification: ${project.unresolvedModerate
        .map((entry) => entry.dependency)
        .join(', ')}`,
    }
  }

  if (!baselineProject) {
    return {
      ok: true,
      reason: 'no baseline yet; current state accepted',
    }
  }

  const baselineKeys = new Set(baselineProject.vulnerabilityKeys ?? [])
  const regressions = project.vulnerabilities.filter(
    (entry) => ['critical', 'high'].includes(entry.severity) && !baselineKeys.has(entry.key),
  )
  if (regressions.length > 0) {
    return {
      ok: false,
      reason: `new blocking regressions detected: ${regressions
        .map((entry) => `${entry.dependency}(${entry.severity})`)
        .join(', ')}`,
    }
  }

  if (baselineProject.lockfileHash !== project.lockfileHash) {
    console.log(`[security] dependency tree changed for ${project.name}`)
  }

  return {
    ok: true,
    reason: 'security gate passed',
  }
}

async function runGate(options) {
  if (!options.project) {
    throw new Error('gate requires --project')
  }

  const report = await generateReport(options.project)
  await writeArtifacts(report)
  printSummary(report)

  const baseline = await readJsonFile(BASELINE_PATH, null)
  const outcome = compareWithBaseline(report, baseline)
  if (!outcome.ok) {
    throw new Error(`Security gate failed for ${options.project}${options.phase ? ` during ${options.phase}` : ''}: ${outcome.reason}`)
  }

  console.log(`[security] gate passed for ${options.project}${options.phase ? ` during ${options.phase}` : ''}`)
}

async function runScan(options) {
  const report = await generateReport(options.project)
  await writeArtifacts(report)
  printSummary(report)

  if (blockingCount(report) === 0 && unresolvedModerateCount(report) === 0) {
    await writeBaseline(report)
  }
}

async function main() {
  if (['1', 'true', 'yes'].includes((process.env.SECURITY_LOOP_SKIP ?? '').toLowerCase())) {
    console.log('[security] SECURITY_LOOP_SKIP is enabled; skipping security checks')
    return
  }

  const options = parseArgs(process.argv.slice(2))
  switch (options.command) {
    case 'scan':
      await runScan(options)
      return
    case 'gate':
      await runGate(options)
      return
    case 'loop':
      await runLoop(options)
      return
    default:
      throw new Error(`Unknown command "${options.command}"`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
