import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { AiAssetExtractionService } from '../ai-asset-extraction.service'

describe('AiAssetExtractionService', () => {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'AI_MODEL_PROVIDER') return 'openai'
      if (key === 'AI_MODEL_NAME') return 'gpt-4o-mini'
      if (key === 'OPENAI_API_KEY') return 'env-test-key'
      return undefined
    }),
  }

  const secureConfig = {
    getJson: vi.fn(async () => ({
      provider: 'openai',
      model: 'gpt-4o-mini',
      openAiApiKey: 'db-test-key',
    })),
  }
  const usage = {
    assertQuotaAvailable: vi.fn(async () => ({
      budget_limit: 25,
      total_spent: 2,
      remaining: 23,
      exceeded: false,
      source: 'openai',
      error: null,
      checked_at: '2026-03-27T00:00:00.000Z',
    })),
  }

  let service: AiAssetExtractionService

  beforeEach(() => {
    vi.restoreAllMocks()
    usage.assertQuotaAvailable.mockClear()
    service = new AiAssetExtractionService(
      config as never,
      secureConfig as never,
      usage as never,
    )
  })

  it('extracts deterministic rows from csv', async () => {
    const csv = Buffer.from('nombre,precio,moneda\nRoller Screen,500,UYU', 'utf8').toString(
      'base64',
    )

    const result = await service.extractOne({
      assetType: 'csv',
      fileName: 'productos.csv',
      contentType: 'text/csv',
      content: csv,
    })

    expect(result.source).toBe('backend_csv')
    expect(result.structuredRows).toHaveLength(1)
    expect(result.structuredRows[0]).toMatchObject({
      nombre: 'Roller Screen',
      precio: '500',
      moneda: 'UYU',
    })
    expect(result.usableForContext).toBe(true)
  })

  it('extracts deterministic rows from xlsx', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet([
      { nombre: 'Roller Blackout', precio: 950, moneda: 'UYU', stock: 2 },
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Productos')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const result = await service.extractOne({
      assetType: 'xlsx',
      fileName: 'productos.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: buffer.toString('base64'),
    })

    expect(result.source).toBe('backend_xlsx')
    expect(result.debug.sheetCount).toBe(1)
    expect(result.structuredRows).toHaveLength(1)
    expect(result.structuredRows[0]).toMatchObject({
      _sheet: 'Productos',
      nombre: 'Roller Blackout',
      precio: '950',
      moneda: 'UYU',
      stock: '2',
    })
  })

  it('uses provided transcript text for audio without needing an external call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await service.extractOne({
      assetType: 'audio',
      fileName: 'nota.webm',
      contentType: 'audio/webm',
      textContent: 'Necesito registrar un cliente nuevo.',
    })

    expect(result.source).toBe('provided_text')
    expect(result.rawText).toContain('Necesito registrar un cliente nuevo')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('uses OpenAI for image text extraction when configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: 'Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234',
      }),
    } as never)

    const result = await service.extractOne({
      assetType: 'image',
      fileName: 'cotizacion.png',
      contentType: 'image/png',
      content: Buffer.from('fake-image').toString('base64'),
    })

    expect(result.source).toBe('openai_image')
    expect(result.stage).toBe('ai')
    expect(result.rawText).toContain('Corrediza 2h2g serie probba')
    expect(result.debug.usedOpenAi).toBe(true)
  })

  it('skips OpenAI extraction when quota is exceeded', async () => {
    usage.assertQuotaAvailable.mockRejectedValueOnce(new Error('Quota exceeded'))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await service.extractOne({
      assetType: 'image',
      fileName: 'cotizacion.png',
      contentType: 'image/png',
      content: Buffer.from('fake-image').toString('base64'),
    })

    expect(result.source).toBe('unparsed')
    expect(result.stage).toBe('failed')
    expect(result.debug.reason).toBe('budget_exceeded')
    expect(result.debug.usedOpenAi).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
