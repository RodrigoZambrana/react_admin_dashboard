import {
  DocumentIngestionStatus,
  DocumentOriginKind,
  ManagedResourceStatus,
} from '@prisma/client';
import { z } from 'zod';

export const documentLifecycleStatusSchema = z.nativeEnum(ManagedResourceStatus);
export const documentIngestionStatusSchema = z.nativeEnum(DocumentIngestionStatus);
export const documentOriginKindSchema = z.nativeEnum(DocumentOriginKind);

export const createTextDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  language: z.string().min(2).max(16).optional(),
  activate: z.boolean().default(true),
  createdBy: z.string().min(1).max(120).optional(),
});

export const ingestDocumentOptionsSchema = z.object({
  activate: z.boolean().default(true),
  createdBy: z.string().min(1).max(120).optional(),
});

export type CreateTextDocumentInput = z.infer<typeof createTextDocumentSchema>;
export type IngestDocumentOptions = z.infer<typeof ingestDocumentOptionsSchema>;

export type ExtractedDocumentSource = {
  originKind: DocumentOriginKind;
  sourceName?: string | null;
  mimeType?: string | null;
  language?: string | null;
  content: string;
};

export type DocumentChunkCandidate = {
  sequence: number;
  content: string;
  searchText: string;
  metadata?: Record<string, unknown>;
};

export type DocumentRetrievalMatch = {
  documentId: string;
  title: string;
  excerpt: string;
  sequence: number;
  score: number;
};

export type DocumentRetrievalResult = {
  source: 'document_origin';
  query: string;
  groundedSummary: string;
  matches: DocumentRetrievalMatch[];
};

export type DocumentRetrievalReason =
  | 'document_query'
  | 'combined_booking_document_query'
  | 'active_document_continuation'
  | 'not_requested';

export type DocumentRetrievalAttempt = {
  attempted: boolean;
  reason: DocumentRetrievalReason;
  result: DocumentRetrievalResult | null;
};
