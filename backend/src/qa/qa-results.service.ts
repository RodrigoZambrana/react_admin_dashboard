import { Injectable } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import * as path from 'node:path'

type QaManifestBlock = {
  id: string
  name: string
  description: string
  kind?: string
  cwd?: string
  command?: string[]
  steps?: Array<{
    cwd: string
    command: string[]
  }>
  estimatedMinutes?: number | null
  tags?: string[]
}

type QaManifest = {
  version: number
  defaultBlockIds?: string[]
  blocks: QaManifestBlock[]
}

type QaRunSnapshot = {
  id: string
  status: string
  startedAt: string
  finishedAt: string | null
  repeat?: number
  selectedBlockIds?: string[]
  blocks: Array<{
    id: string
    blockId: string
    name: string
    description: string
    kind?: string
    tags?: string[]
    estimatedMinutes?: number | null
    attempt?: number
    status: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    cwd?: string
    commandDisplay?: string | null
    steps?: Array<{
      index: number
      cwd: string
      commandDisplay: string
      logFile?: string
      startedAt: string
      finishedAt: string
      exitCode: number
      status: string
      summary?: string
    }>
  }>
}

@Injectable()
export class QaResultsService {
  private readonly resultsDir = this.resolveResultsDir()
  private readonly manifestPath = this.resolveManifestPath()

  async listCatalog() {
    const manifest = await this.readManifest()
    return {
      version: manifest.version,
      defaultBlockIds: manifest.defaultBlockIds ?? [],
      blocks: manifest.blocks.map((block) => ({
        id: block.id,
        name: block.name,
        description: block.description,
        kind: block.kind ?? 'unknown',
        estimatedMinutes: block.estimatedMinutes ?? null,
        tags: block.tags ?? [],
        cwd: block.cwd ?? null,
        commandDisplay: this.toCommandDisplay(block),
      })),
    }
  }

  async getLatestRun() {
    const latestPath = path.join(this.resultsDir, 'latest.json')
    if (!existsSync(latestPath)) {
      return null
    }
    return this.readJsonFile<QaRunSnapshot>(latestPath)
  }

  async listRuns(limit = 10) {
    await mkdir(path.join(this.resultsDir, 'runs'), { recursive: true })
    const entries = await readdir(path.join(this.resultsDir, 'runs'))
    const candidates = entries
      .filter(
        (entry) =>
          entry.endsWith('.json') &&
          !entry.endsWith('.conversation-quality.json'),
      )
      .sort()
      .reverse()

    const runs = (
      await Promise.all(
        candidates.map(async (entry) => {
          try {
            const run = await this.readJsonFile<Partial<QaRunSnapshot>>(
              path.join(this.resultsDir, 'runs', entry),
            )
            if (!this.isRunSnapshot(run)) {
              return null
            }
            return run
          } catch {
            return null
          }
        }),
      )
    )
      .filter((run): run is QaRunSnapshot => Boolean(run))
      .slice(0, limit)

    return runs.map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      repeat: run.repeat ?? 1,
      selectedBlockIds: run.selectedBlockIds ?? [],
      blocks: run.blocks.map((block) => ({
        id: block.id,
        blockId: block.blockId,
        name: block.name,
        status: block.status,
        attempt: block.attempt ?? 1,
        durationMs: block.durationMs,
      })),
    }))
  }

  async getRun(runId: string) {
    const filePath = path.join(this.resultsDir, 'runs', `${runId}.json`)
    if (!existsSync(filePath)) {
      return null
    }
    return this.readJsonFile<QaRunSnapshot>(filePath)
  }

  private resolveResultsDir() {
    const candidates = [
      process.env.QA_RESULTS_DIR,
      '/qa-results',
      path.resolve(process.cwd(), '..', '.qa'),
      path.resolve(process.cwd(), '.qa'),
    ].filter((value): value is string => Boolean(value))

    return candidates[0]
  }

  private resolveManifestPath() {
    const candidates = [
      process.env.QA_MANIFEST_PATH,
      '/qa-tools/manifest.json',
      path.resolve(process.cwd(), '..', 'tools', 'qa', 'manifest.json'),
      path.resolve(process.cwd(), 'tools', 'qa', 'manifest.json'),
    ].filter((value): value is string => Boolean(value))

    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
  }

  private async readManifest() {
    return this.readJsonFile<QaManifest>(this.manifestPath)
  }

  private isRunSnapshot(run: Partial<QaRunSnapshot> | null | undefined): run is QaRunSnapshot {
    return Boolean(
      run &&
        typeof run.id === 'string' &&
        typeof run.status === 'string' &&
        typeof run.startedAt === 'string' &&
        Array.isArray(run.blocks),
    )
  }

  private async readJsonFile<T>(filePath: string): Promise<T> {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  }

  private toCommandDisplay(block: QaManifestBlock) {
    if (Array.isArray(block.steps) && block.steps.length > 0) {
      return block.steps.map((step) => `${step.cwd}: ${step.command.join(' ')}`).join('\n')
    }
    if (Array.isArray(block.command) && block.command.length > 0) {
      return `${block.cwd ?? '.'}: ${block.command.join(' ')}`
    }
    return ''
  }
}
