import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { parse as parseCsv } from 'csv-parse/sync'
import { PDFParse } from 'pdf-parse'
import * as XLSX from 'xlsx'
import { SecureConfigService } from '../../common/security/secure-config.service'
import { ExtractAiAssetDto } from '../dto/extract-ai-assets.dto'
import { OpenAiUsageService } from '../openai-usage.service'
import {
  ExtractedAsset,
  ExtractedAssetSource,
  ExtractedAssetType,
  ExtractedStructuredRow,
} from './extracted-asset.types'

type RuntimeConfig = {
  provider: 'mock' | 'openai' | 'ollama'
  model: string
  openAiApiKey?: string | null
}

@Injectable()
export class AiAssetExtractionService {
  private static readonly AI_RUNTIME_CONFIG_KEY = 'AI_RUNTIME_CONFIG'

  constructor(
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
    private readonly usage: OpenAiUsageService,
  ) {}

  async extractMany(
    assets: ExtractAiAssetDto[],
  ): Promise<{ items: ExtractedAsset[] }> {
    const items: ExtractedAsset[] = []
    for (const asset of assets ?? []) {
      items.push(await this.extractOne(asset))
    }
    return { items }
  }

  async extractOne(input: ExtractAiAssetDto): Promise<ExtractedAsset> {
    const assetType = this.resolveAssetType(input)
    const decoded = this.decodeContent(input)
    const providedText = this.normalizeText(
      typeof input.textContent === 'string'
        ? input.textContent
        : this.getMetadataText(input.metadata),
    )

    if (providedText) {
      return this.buildResult({
        assetType,
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? decoded.contentType ?? null,
        source: 'provided_text',
        stage: 'deterministic',
        rawText: providedText,
        structuredRows: [],
        confidence: 0.96,
        requiresStructuredExtraction: true,
        byteLength: decoded.buffer?.byteLength ?? null,
        usedOpenAi: false,
        reason: 'used_provided_text',
      })
    }

    if (assetType === 'csv' && decoded.buffer) {
      return this.extractCsv(input, decoded.buffer, decoded.contentType)
    }

    if (assetType === 'xlsx' && decoded.buffer) {
      return this.extractXlsx(input, decoded.buffer, decoded.contentType)
    }

    if (assetType === 'pdf' && decoded.buffer) {
      return this.extractPdf(input, decoded.buffer, decoded.contentType)
    }

    if (assetType === 'audio' && decoded.buffer) {
      return this.extractAudio(input, decoded.buffer, decoded.contentType)
    }

    if (assetType === 'image' && decoded.buffer) {
      return this.extractImage(input, decoded.buffer, decoded.contentType)
    }

    return this.buildResult({
      assetType,
      fileName: input.fileName ?? null,
      contentType: input.contentType ?? decoded.contentType ?? null,
      source: 'unparsed',
      stage: 'failed',
      rawText: null,
      structuredRows: [],
      confidence: 0,
      requiresStructuredExtraction: false,
      byteLength: decoded.buffer?.byteLength ?? null,
      usedOpenAi: false,
      reason: decoded.buffer
        ? 'unsupported_asset_type'
        : 'missing_asset_content',
      warnings: [
        decoded.buffer
          ? 'No existe extractor configurado para este tipo de archivo.'
          : 'No se recibió contenido suficiente para procesar el adjunto.',
      ],
      usableForContext: false,
    })
  }

  private async extractCsv(
    input: ExtractAiAssetDto,
    buffer: Buffer,
    detectedContentType?: string | null,
  ): Promise<ExtractedAsset> {
    try {
      const text = buffer.toString('utf8')
      const rows = parseCsv(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as ExtractedStructuredRow[]

      const rawText = rows
        .slice(0, 25)
        .map((row) =>
          Object.entries(row)
            .map(([key, value]) => `${key}: ${value ?? ''}`)
            .join(' | '),
        )
        .join('\n')

      return this.buildResult({
        assetType: 'csv',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'text/csv',
        source: 'backend_csv',
        stage: 'deterministic',
        rawText,
        structuredRows: rows,
        confidence: rows.length > 0 ? 0.98 : 0.65,
        requiresStructuredExtraction: rows.length > 0,
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: 'csv_parsed',
      })
    } catch (error) {
      return this.buildResult({
        assetType: 'csv',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'text/csv',
        source: 'unparsed',
        stage: 'failed',
        rawText: null,
        structuredRows: [],
        confidence: 0,
        requiresStructuredExtraction: false,
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: error instanceof Error ? error.message : 'csv_parse_failed',
        warnings: ['No fue posible interpretar el CSV de forma determinística.'],
        usableForContext: false,
      })
    }
  }

  private async extractXlsx(
    input: ExtractAiAssetDto,
    buffer: Buffer,
    detectedContentType?: string | null,
  ): Promise<ExtractedAsset> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const rows: ExtractedStructuredRow[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
          sheet,
          {
            header: 1,
            raw: false,
            defval: '',
          },
        )
        const [headerRow, ...dataRows] = matrix
        const headers =
          Array.isArray(headerRow) && headerRow.length > 0
            ? headerRow.map((value, index) =>
                String(value || `column_${index + 1}`).trim() || `column_${index + 1}`,
              )
            : []

        for (const dataRow of dataRows) {
          if (!Array.isArray(dataRow)) {
            continue
          }
          const row: ExtractedStructuredRow = { _sheet: sheetName }
          dataRow.forEach((value, index) => {
            row[headers[index] || `column_${index + 1}`] =
              value === '' ? null : value ?? null
          })
          rows.push(row)
        }
      }

      const rawText = rows
        .slice(0, 25)
        .map((row) =>
          Object.entries(row)
            .map(([key, value]) => `${key}: ${value ?? ''}`)
            .join(' | '),
        )
        .join('\n')

      return this.buildResult({
        assetType: 'xlsx',
        fileName: input.fileName ?? null,
        contentType:
          input.contentType ??
          detectedContentType ??
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        source: 'backend_xlsx',
        stage: 'deterministic',
        rawText,
        structuredRows: rows,
        confidence: rows.length > 0 ? 0.97 : 0.65,
        requiresStructuredExtraction: rows.length > 0,
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: 'xlsx_parsed',
        sheetCount: workbook.SheetNames.length,
      })
    } catch (error) {
      return this.buildResult({
        assetType: 'xlsx',
        fileName: input.fileName ?? null,
        contentType:
          input.contentType ??
          detectedContentType ??
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        source: 'unparsed',
        stage: 'failed',
        rawText: null,
        structuredRows: [],
        confidence: 0,
        requiresStructuredExtraction: false,
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: error instanceof Error ? error.message : 'xlsx_parse_failed',
        warnings: ['No fue posible interpretar el XLSX de forma determinística.'],
        usableForContext: false,
      })
    }
  }

  private async extractPdf(
    input: ExtractAiAssetDto,
    buffer: Buffer,
    detectedContentType?: string | null,
  ): Promise<ExtractedAsset> {
    try {
      const parser = new PDFParse({ data: buffer })
      const parsed = await parser.getText()
      await parser.destroy()
      const rawText = this.normalizeText(parsed.text)
      return this.buildResult({
        assetType: 'pdf',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'application/pdf',
        source: 'backend_pdf',
        stage: 'deterministic',
        rawText,
        structuredRows: [],
        confidence: rawText ? 0.9 : 0.4,
        requiresStructuredExtraction: Boolean(rawText),
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: rawText ? 'pdf_text_extracted' : 'pdf_without_text',
        warnings: rawText ? [] : ['El PDF no devolvió texto utilizable en extracción local.'],
      })
    } catch (error) {
      return this.buildResult({
        assetType: 'pdf',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'application/pdf',
        source: 'unparsed',
        stage: 'failed',
        rawText: null,
        structuredRows: [],
        confidence: 0,
        requiresStructuredExtraction: false,
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: error instanceof Error ? error.message : 'pdf_parse_failed',
        warnings: ['No fue posible extraer texto del PDF localmente.'],
        usableForContext: false,
      })
    }
  }

  private async extractAudio(
    input: ExtractAiAssetDto,
    buffer: Buffer,
    detectedContentType?: string | null,
  ): Promise<ExtractedAsset> {
    const runtimeConfig = await this.getRuntimeConfig()
    if (input.preferAi === false || runtimeConfig.provider !== 'openai' || !runtimeConfig.openAiApiKey) {
      return this.buildResult({
        assetType: 'audio',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'audio/mpeg',
        source: 'unparsed',
        stage: 'failed',
        rawText: null,
        structuredRows: [],
        confidence: 0,
        requiresStructuredExtraction: false,
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: 'audio_requires_ai_transcription',
        warnings: ['El audio requiere transcripción externa o IA para poder usarse operativamente.'],
        usableForContext: false,
      })
    }

    try {
      await this.usage.assertQuotaAvailable()
      const rawText = await this.transcribeAudioWithOpenAi(
        buffer,
        input.fileName ?? 'audio.webm',
        input.contentType ?? detectedContentType ?? 'audio/webm',
        runtimeConfig.openAiApiKey,
      )
      return this.buildResult({
        assetType: 'audio',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'audio/webm',
        source: 'openai_audio',
        stage: 'ai',
        rawText,
        structuredRows: [],
        confidence: rawText ? 0.86 : 0.35,
        requiresStructuredExtraction: Boolean(rawText),
        byteLength: buffer.byteLength,
        usedOpenAi: true,
        reason: rawText ? 'audio_transcribed' : 'audio_without_transcript',
      })
    } catch (error) {
      const quotaBlocked = this.isQuotaBlockedError(error)
      return this.buildResult({
        assetType: 'audio',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'audio/webm',
        source: 'unparsed',
        stage: 'failed',
        rawText: null,
        structuredRows: [],
        confidence: 0,
        requiresStructuredExtraction: false,
        byteLength: buffer.byteLength,
        usedOpenAi: !quotaBlocked,
        reason: quotaBlocked
          ? 'budget_exceeded'
          : error instanceof Error
            ? error.message
            : 'audio_transcription_failed',
        warnings: [
          quotaBlocked
            ? 'La transcripción IA del audio se omitió porque el presupuesto mensual configurado ya quedó excedido.'
            : 'Falló la transcripción IA del audio.',
        ],
        usableForContext: false,
      })
    }
  }

  private async extractImage(
    input: ExtractAiAssetDto,
    buffer: Buffer,
    detectedContentType?: string | null,
  ): Promise<ExtractedAsset> {
    const runtimeConfig = await this.getRuntimeConfig()
    if (input.preferAi === false || runtimeConfig.provider !== 'openai' || !runtimeConfig.openAiApiKey) {
      return this.buildResult({
        assetType: 'image',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'image/png',
        source: 'unparsed',
        stage: 'failed',
        rawText: null,
        structuredRows: [],
        confidence: 0,
        requiresStructuredExtraction: false,
        byteLength: buffer.byteLength,
        usedOpenAi: false,
        reason: 'image_requires_ai_or_ocr',
        warnings: ['La imagen requiere OCR o extracción IA antes de poder usarse operativamente.'],
        usableForContext: false,
      })
    }

    try {
      await this.usage.assertQuotaAvailable()
      const rawText = await this.extractImageTextWithOpenAi(
        buffer,
        input.contentType ?? detectedContentType ?? 'image/png',
        runtimeConfig,
      )
      return this.buildResult({
        assetType: 'image',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'image/png',
        source: 'openai_image',
        stage: 'ai',
        rawText,
        structuredRows: [],
        confidence: rawText ? 0.8 : 0.35,
        requiresStructuredExtraction: Boolean(rawText),
        byteLength: buffer.byteLength,
        usedOpenAi: true,
        reason: rawText ? 'image_text_extracted' : 'image_without_text',
      })
    } catch (error) {
      const quotaBlocked = this.isQuotaBlockedError(error)
      return this.buildResult({
        assetType: 'image',
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? detectedContentType ?? 'image/png',
        source: 'unparsed',
        stage: 'failed',
        rawText: null,
        structuredRows: [],
        confidence: 0,
        requiresStructuredExtraction: false,
        byteLength: buffer.byteLength,
        usedOpenAi: !quotaBlocked,
        reason: quotaBlocked
          ? 'budget_exceeded'
          : error instanceof Error
            ? error.message
            : 'image_extraction_failed',
        warnings: [
          quotaBlocked
            ? 'La extracción IA de texto desde la imagen se omitió porque el presupuesto mensual configurado ya quedó excedido.'
            : 'Falló la extracción IA de texto desde la imagen.',
        ],
        usableForContext: false,
      })
    }
  }

  private async transcribeAudioWithOpenAi(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    apiKey: string,
  ): Promise<string> {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType })
    form.append('file', blob, fileName)
    form.append('model', 'whisper-1')
    form.append('response_format', 'text')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
      body: form,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`openai_audio_transcription_${response.status}: ${body}`)
    }

    return this.normalizeText(await response.text()) ?? ''
  }

  private async extractImageTextWithOpenAi(
    buffer: Buffer,
    contentType: string,
    runtimeConfig: RuntimeConfig,
  ): Promise<string> {
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${runtimeConfig.openAiApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: runtimeConfig.model || 'gpt-4o-mini',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Extrae todo el texto legible y los datos operativos relevantes de esta imagen. Responde solamente con el texto extraído, sin explicación adicional.',
              },
              {
                type: 'input_image',
                image_url: dataUrl,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`openai_image_extraction_${response.status}: ${body}`)
    }

    const payload = (await response.json()) as {
      output_text?: string
    }
    return this.normalizeText(payload.output_text ?? '') ?? ''
  }

  private buildResult(input: {
    assetType: ExtractedAssetType
    fileName: string | null
    contentType: string | null
    source: ExtractedAssetSource
    stage: 'deterministic' | 'ai' | 'failed'
    rawText: string | null
    structuredRows: ExtractedStructuredRow[]
    confidence: number
    requiresStructuredExtraction: boolean
    byteLength: number | null
    usedOpenAi: boolean
    reason: string | null
    sheetCount?: number | null
    warnings?: string[]
    usableForContext?: boolean
  }): ExtractedAsset {
    const rawText = this.normalizeText(input.rawText)
    return {
      assetType: input.assetType,
      fileName: input.fileName,
      contentType: input.contentType,
      source: input.source,
      stage: input.stage,
      rawText,
      normalizedText: rawText,
      structuredRows: input.structuredRows,
      warnings: input.warnings ?? [],
      confidence: input.confidence,
      requiresStructuredExtraction: input.requiresStructuredExtraction,
      usableForContext:
        input.usableForContext ??
        (Boolean(rawText) ||
          (Array.isArray(input.structuredRows) && input.structuredRows.length > 0)),
      debug: {
        byteLength: input.byteLength,
        rowCount: input.structuredRows.length,
        sheetCount: input.sheetCount ?? null,
        usedOpenAi: input.usedOpenAi,
        reason: input.reason,
      },
    }
  }

  private normalizeText(value: unknown): string | null {
    const text = String(value || '')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
    return text.length > 0 ? text : null
  }

  private decodeContent(input: ExtractAiAssetDto): {
    buffer: Buffer | null
    contentType: string | null
  } {
    const content = typeof input.content === 'string' ? input.content.trim() : ''
    if (!content) {
      return { buffer: null, contentType: input.contentType ?? null }
    }

    const dataMatch = content.match(/^data:(.*?);base64,(.*)$/)
    if (dataMatch) {
      return {
        buffer: Buffer.from(dataMatch[2], 'base64'),
        contentType: dataMatch[1] || input.contentType || null,
      }
    }

    return {
      buffer: Buffer.from(content, 'base64'),
      contentType: input.contentType ?? null,
    }
  }

  private resolveAssetType(input: ExtractAiAssetDto): ExtractedAssetType {
    const explicit = String(input.assetType || '')
      .trim()
      .toLowerCase()
    if (
      explicit === 'text' ||
      explicit === 'pdf' ||
      explicit === 'image' ||
      explicit === 'audio' ||
      explicit === 'csv' ||
      explicit === 'xlsx'
    ) {
      return explicit
    }

    const contentType = String(input.contentType || '').toLowerCase()
    const fileName = String(input.fileName || '').toLowerCase()

    if (contentType.includes('pdf') || fileName.endsWith('.pdf')) return 'pdf'
    if (
      contentType.includes('spreadsheetml') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      return 'xlsx'
    }
    if (contentType.includes('csv') || fileName.endsWith('.csv')) return 'csv'
    if (contentType.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/i.test(fileName))
      return 'image'
    if (contentType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(fileName))
      return 'audio'
    if (!input.content && (input.textContent || this.getMetadataText(input.metadata))) {
      return 'text'
    }
    return 'unknown'
  }

  private getMetadataText(metadata?: Record<string, unknown>): string | null {
    const candidates = [
      metadata?.transcriptText,
      metadata?.ocrText,
      metadata?.rawText,
      metadata?.text,
      metadata?.body,
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate
      }
    }
    return null
  }

  private isQuotaBlockedError(error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'getStatus' in error &&
      typeof error.getStatus === 'function'
    ) {
      try {
        if (error.getStatus() === 403) {
          return true
        }
      } catch {
        // noop
      }
    }

    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase()
    return message.includes('quota exceeded') || message.includes('budget exceeded')
  }

  private async getRuntimeConfig(): Promise<RuntimeConfig> {
    const storedRecord = await this.secureConfig.getJson<Partial<RuntimeConfig>>(
      AiAssetExtractionService.AI_RUNTIME_CONFIG_KEY,
    )
    const stored = storedRecord?.value
    return {
      provider:
        stored?.provider ??
        ((this.config.get<string>('AI_MODEL_PROVIDER') as RuntimeConfig['provider']) ||
          'openai'),
      model: stored?.model ?? this.config.get<string>('AI_MODEL_NAME') ?? 'gpt-4o-mini',
      openAiApiKey:
        stored?.openAiApiKey !== undefined
          ? stored.openAiApiKey
          : this.config.get<string>('OPENAI_API_KEY') ?? '',
    }
  }
}
