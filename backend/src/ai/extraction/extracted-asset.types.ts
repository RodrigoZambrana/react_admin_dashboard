export type ExtractedAssetType =
  | 'text'
  | 'pdf'
  | 'image'
  | 'audio'
  | 'csv'
  | 'xlsx'
  | 'unknown'

export type ExtractedAssetSource =
  | 'provided_text'
  | 'backend_csv'
  | 'backend_xlsx'
  | 'backend_pdf'
  | 'openai_image'
  | 'openai_audio'
  | 'unparsed'

export type ExtractedAssetStage = 'deterministic' | 'ai' | 'failed'

export type ExtractedStructuredRow = Record<
  string,
  string | number | boolean | null
>

export type ExtractedAsset = {
  assetType: ExtractedAssetType
  fileName: string | null
  contentType: string | null
  source: ExtractedAssetSource
  stage: ExtractedAssetStage
  rawText: string | null
  normalizedText: string | null
  structuredRows: ExtractedStructuredRow[]
  warnings: string[]
  confidence: number
  requiresStructuredExtraction: boolean
  usableForContext: boolean
  debug: {
    byteLength: number | null
    rowCount: number
    sheetCount: number | null
    usedOpenAi: boolean
    reason: string | null
  }
}
