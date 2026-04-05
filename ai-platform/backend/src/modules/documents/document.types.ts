import {
  DocumentIngestionStatus,
  DocumentOriginKind,
  ManagedResourceStatus,
} from '@prisma/client';
import { z } from 'zod';
import type { DocumentExtractionProfileId } from './document-extraction-profile.types';

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

export const createUrlDocumentSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(200).optional(),
  language: z.string().min(2).max(16).optional(),
  activate: z.boolean().default(true),
  createdBy: z.string().min(1).max(120).optional(),
});

export const ingestDocumentOptionsSchema = z.object({
  activate: z.boolean().default(true),
  createdBy: z.string().min(1).max(120).optional(),
});

export type CreateTextDocumentInput = z.infer<typeof createTextDocumentSchema>;
export type CreateUrlDocumentInput = z.infer<typeof createUrlDocumentSchema>;
export type IngestDocumentOptions = z.infer<typeof ingestDocumentOptionsSchema>;

export type ExtractedDocumentSource = {
  originKind: DocumentOriginKind;
  sourceName?: string | null;
  mimeType?: string | null;
  language?: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
};

export type DocumentKnowledgeItemKind = 'entity' | 'claim';
export type DocumentKnowledgeSupportClass =
  | 'explicit_fact'
  | 'partial_fact'
  | 'bounded_inference';

export type DocumentKnowledgeExtractionScope = 'core' | 'tenant_only';

export type DocumentSemanticBlock = {
  content: string;
  section?: string;
  page?: number;
  sheet?: string;
};

export type DocumentKnowledgeClaimPayload = {
  axis: string;
  kind: 'value_list' | 'qualifier' | 'relation_target';
  values: string[];
};

export type DocumentKnowledgeItemMetadata = {
  section?: string;
  page?: number;
  sheet?: string;
  extractionScope?: DocumentKnowledgeExtractionScope;
  profileKey?: DocumentExtractionProfileId;
  unspecifiedAxes?: string[];
  claim?: DocumentKnowledgeClaimPayload;
};

export type DocumentKnowledgeAxisSummary = {
  axis: string;
  values: string[];
  supportClass: DocumentKnowledgeSupportClass;
  extractionScope?: DocumentKnowledgeExtractionScope;
  unspecifiedAxes?: string[];
};

export type DocumentKnowledgeItemCandidate = {
  sequence: number;
  kind: DocumentKnowledgeItemKind;
  label: string;
  valueText: string;
  normalizedValue?: string;
  supportClass: DocumentKnowledgeSupportClass;
  evidenceTextSpan: string;
  metadata?: DocumentKnowledgeItemMetadata;
};

export type DocumentKnowledgeItemSeed = Omit<
  DocumentKnowledgeItemCandidate,
  'sequence'
>;

export type DocumentChunkCandidate = {
  sequence: number;
  content: string;
  searchText: string;
  retrievalProjection: string;
  metadata?: Record<string, unknown>;
  structuredItems?: DocumentKnowledgeItemCandidate[];
};

export type DocumentRetrievalMatch = {
  documentId: string;
  title: string;
  excerpt: string;
  sequence: number;
  score: number;
  supportSummary?: {
    topic?: string;
    supportedAxes: string[];
    unspecifiedAxes: string[];
    axisSummaries?: DocumentKnowledgeAxisSummary[];
  };
};

export type DocumentRetrievalResult = {
  source: 'document_origin';
  query: string;
  groundedSummary: string;
  matches: DocumentRetrievalMatch[];
};

export type DocumentRetrievalReason =
  | 'document_query'
  | 'knowledge_query'
  | 'combined_booking_document_query'
  | 'active_document_continuation'
  | 'not_requested';

export type DocumentRetrievalAttempt = {
  attempted: boolean;
  reason: DocumentRetrievalReason;
  result: DocumentRetrievalResult | null;
};
