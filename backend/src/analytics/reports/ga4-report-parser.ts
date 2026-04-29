import { parse } from 'csv-parse/sync'

import {
  findGa4ReportDefinition,
  normalizeGa4ReportText,
  type AnalyticsReportCatalogEntry,
} from './ga4-report-catalog'

export type ParsedGa4BaselineReport = {
  definition: AnalyticsReportCatalogEntry
  title: string | null
  header: string
  rows: string[][]
}

const isCommentLine = (line: string) => line.trim().startsWith('#')

const stripComment = (line: string) => line.trim().replace(/^#\s?/, '')

const isDataLine = (line: string) => !isCommentLine(line) && line.trim().length > 0

const csvOptions = {
  relaxColumnCount: true,
  skipEmptyLines: true,
  trim: true,
}

export const splitGa4BaselineBlocks = (content: string): ParsedGa4BaselineReport[] => {
  const lines = content.split(/\r?\n/u)
  const blocks: ParsedGa4BaselineReport[] = []
  let pendingComments: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (isCommentLine(line)) {
      pendingComments.push(stripComment(line))
      index += 1
      continue
    }

    if (!isDataLine(line)) {
      index += 1
      continue
    }

    const header = line.trim()
    const dataLines: string[] = []
    index += 1

    while (index < lines.length) {
      const next = lines[index] ?? ''
      if (isCommentLine(next)) {
        break
      }
      if (!next.trim()) {
        const lookAhead = lines.slice(index + 1).find((candidate) => candidate.trim().length > 0)
        if (!lookAhead || isCommentLine(lookAhead)) {
          break
        }
        index += 1
        continue
      }

      dataLines.push(next)
      index += 1
    }

    const title = pendingComments.find((entry) => entry.startsWith('¿')) ?? null
    const definition = findGa4ReportDefinition({ header, title })
    if (definition) {
      const parsedRows =
        dataLines.length > 0
          ? (parse([header, ...dataLines].join('\n'), csvOptions) as string[][])
          : []
      blocks.push({
        definition,
        title,
        header,
        rows: parsedRows.slice(1),
      })
    }

    pendingComments = []
  }

  return blocks
}

export const normalizeReportRowKey = (
  definition: AnalyticsReportCatalogEntry,
  row: Record<string, string>,
  rowIndex: number,
) => {
  if (definition.rowKeyStrategy === 'row_index') {
    return `${String(rowIndex).padStart(6, '0')}`
  }

  const dimensions = definition.dimensionLabels.map((label) => row[label] ?? '').join(' | ')
  return normalizeGa4ReportText(dimensions)
}

