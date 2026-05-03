import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { AiAssetExtractionService } from '../ai-asset-extraction.service'

describe('AiAssetExtractionService', () => {
  const openAiClient = {
    resolveRuntimeConfig: vi.fn(async () => ({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      openAiApiKey: 'db-test-key',
    })),
    requestJson: vi.fn(),
    requestText: vi.fn(),
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
    openAiClient.resolveRuntimeConfig.mockClear()
    openAiClient.requestJson.mockClear()
    openAiClient.requestText.mockClear()
    service = new AiAssetExtractionService(openAiClient as never, usage as never)
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
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Productos')
    sheet.addRow(['nombre', 'precio', 'moneda', 'stock'])
    sheet.addRow(['Roller Blackout', 950, 'UYU', 2])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

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
    const result = await service.extractOne({
      assetType: 'audio',
      fileName: 'nota.webm',
      contentType: 'audio/webm',
      textContent: 'Necesito registrar un cliente nuevo.',
    })

    expect(result.source).toBe('provided_text')
    expect(result.rawText).toContain('Necesito registrar un cliente nuevo')
    expect(openAiClient.requestJson).not.toHaveBeenCalled()
    expect(openAiClient.requestText).not.toHaveBeenCalled()
  })

  it('uses OpenAI for image text extraction when configured', async () => {
    openAiClient.requestJson.mockResolvedValueOnce({
      output_text: 'Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234',
    })

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
    expect(openAiClient.requestJson).not.toHaveBeenCalled()
    expect(openAiClient.requestText).not.toHaveBeenCalled()
  })
})
