import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { QaResultsService } from '../qa-results.service'

describe('QaResultsService', () => {
  let tempDir: string
  let previousResultsDir: string | undefined
  let previousManifestPath: string | undefined

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'qa-results-'))
    await mkdir(path.join(tempDir, 'runs'), { recursive: true })
    previousResultsDir = process.env.QA_RESULTS_DIR
    previousManifestPath = process.env.QA_MANIFEST_PATH
    process.env.QA_RESULTS_DIR = tempDir
    process.env.QA_MANIFEST_PATH = path.join(tempDir, 'manifest.json')

    await writeFile(
      process.env.QA_MANIFEST_PATH,
      JSON.stringify(
        {
          version: 1,
          defaultBlockIds: ['block-a'],
          blocks: [
            {
              id: 'block-a',
              name: 'Smoke',
              description: 'Basic smoke block',
              kind: 'e2e',
              cwd: '.',
              command: ['node', 'scripts/smoke.mjs'],
              estimatedMinutes: 4,
              tags: ['smoke'],
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    )

    await writeFile(
      path.join(tempDir, 'latest.json'),
      JSON.stringify(
        {
          id: 'run-latest',
          status: 'passed',
          startedAt: '2026-04-27T10:00:00.000Z',
          finishedAt: '2026-04-27T10:01:00.000Z',
          blocks: [],
        },
        null,
        2,
      ),
      'utf8',
    )

    await writeFile(
      path.join(tempDir, 'runs', 'run-001.json'),
      JSON.stringify(
        {
          id: 'run-001',
          status: 'passed',
          startedAt: '2026-04-26T10:00:00.000Z',
          finishedAt: '2026-04-26T10:01:00.000Z',
          blocks: [
            {
              id: 'block-run-001',
              blockId: 'block-a',
              name: 'Smoke',
              status: 'passed',
              attempt: 1,
              durationMs: 1234,
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    )
  })

  afterEach(() => {
    process.env.QA_RESULTS_DIR = previousResultsDir
    process.env.QA_MANIFEST_PATH = previousManifestPath
  })

  it('loads the QA catalog and latest run from persisted artifacts', async () => {
    const service = new QaResultsService()

    const catalog = await service.listCatalog()
    const latest = await service.getLatestRun()
    const runs = await service.listRuns(10)

    expect(catalog.version).toBe(1)
    expect(catalog.blocks[0]?.commandDisplay).toContain('node scripts/smoke.mjs')
    expect(latest?.id).toBe('run-latest')
    expect(runs[0]?.id).toBe('run-001')
    expect(runs[0]?.blocks[0]?.status).toBe('passed')
  })
})
