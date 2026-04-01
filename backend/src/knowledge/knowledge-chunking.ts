import { createHash } from 'crypto'

export const KNOWLEDGE_RETRIEVAL_CHUNK_SIZE = 900
export const KNOWLEDGE_RETRIEVAL_CHUNK_OVERLAP = 160
export const KNOWLEDGE_RETRIEVAL_MAX_CHUNKS_PER_DOCUMENT = 8
export const KNOWLEDGE_RETRIEVAL_MAX_CHUNK_DOCUMENTS = 24

export type KnowledgeDocumentChunkProjection = {
  id: string
  index: number
  text: string
  charStart: number
  charEnd: number
}

export const buildKnowledgeDocumentChunks = (document: {
  id: string
  content: string
}) => {
  const source = String(document.content || '').trim()
  if (!source) {
    return []
  }

  const chunks: KnowledgeDocumentChunkProjection[] = []
  let start = 0

  while (
    start < source.length &&
    chunks.length < KNOWLEDGE_RETRIEVAL_MAX_CHUNKS_PER_DOCUMENT
  ) {
    let end = Math.min(start + KNOWLEDGE_RETRIEVAL_CHUNK_SIZE, source.length)
    if (end < source.length) {
      const boundarySlice = source.slice(end, Math.min(end + 120, source.length))
      const boundaryMatch = boundarySlice.match(/^[^\n.!?]{0,120}(?:[.!?]\s|\n|$)/u)
      if (boundaryMatch?.[0]) {
        end += boundaryMatch[0].length
      }
    }

    const text = source.slice(start, end).trim()
    if (text) {
      chunks.push({
        id: createHash('sha1')
          .update(`${document.id}:${start}:${end}:${text}`)
          .digest('hex')
          .slice(0, 16),
        index: chunks.length,
        text,
        charStart: start,
        charEnd: end,
      })
    }

    if (end >= source.length) {
      break
    }

    start = Math.max(end - KNOWLEDGE_RETRIEVAL_CHUNK_OVERLAP, start + 1)
  }

  return chunks
}
