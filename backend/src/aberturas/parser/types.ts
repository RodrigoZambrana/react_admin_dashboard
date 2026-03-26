export type AberturasAliasEntry = {
  alias: string
  label: string
  value: string
}

export type AberturasGlossaryGrouped = Record<
  string,
  Array<{ label?: string; value?: string }>
>

export type ParsedAberturasItem = {
  lineNumber: number
  rawLine: string
  familyId: string | null
  familyLabel: string | null
  serie: string | null
  material: string
  color: string | null
  vidrio: string | null
  widthMm: number | null
  heightMm: number | null
  hasMosquitero: boolean
  hasShutterMonoblock: boolean
  shutterSystem: string | null
  price: number | null
  currency: string | null
  extras: string[]
  missingFields: string[]
  doubtfulFields: string[]
  processingScore: number
  validForAutoProcess: boolean
  readyForQuote: boolean
  detalleSnapshot: string
  confidenceScore: number
}

export type ParsedAberturasContext = {
  config: Record<string, unknown>
  items: ParsedAberturasItem[]
}
