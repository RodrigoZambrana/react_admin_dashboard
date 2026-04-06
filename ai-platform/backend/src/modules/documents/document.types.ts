import {
  DocumentIngestionStatus,
  DocumentOriginKind,
  ManagedResourceStatus,
} from '@prisma/client';
import { z } from 'zod';
import type { DocumentExtractionProfileId } from './document-extraction-profile.types';
import type {
  DocumentExtractionProfileConfigSource,
  DocumentExtractionProfileDerivedHints,
} from './document-extraction-profile-config.service';

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

export const updateDocumentSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(50000).optional(),
    language: z.string().max(16).nullable().optional(),
    createdBy: z.string().min(1).max(120).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.content !== undefined ||
      value.language !== undefined,
    {
      message: 'At least one document field must be provided',
    },
  );

export type CreateTextDocumentInput = z.infer<typeof createTextDocumentSchema>;
export type CreateUrlDocumentInput = z.infer<typeof createUrlDocumentSchema>;
export type IngestDocumentOptions = z.infer<typeof ingestDocumentOptionsSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

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

export type DocumentKnowledgeExtractionScope =
  | 'core_universal'
  | 'domain_profile'
  | 'tenant_only';

export type DocumentKnowledgeLayer =
  | 'factual'
  | 'prudence'
  | 'workflow'
  | 'guidance';

export type DocumentCorpusRole =
  | 'mixed_master'
  | 'factual_master'
  | 'operational_guide'
  | 'prudence_policy';

export type DocumentKnowledgeScopedValue = {
  axis: string;
  value: string;
  normalizedValue?: string;
};

export type DocumentSemanticBlock = {
  content: string;
  section?: string;
  parentSection?: string;
  page?: number;
  sheet?: string;
};

export type DocumentKnowledgeClaimPayload = {
  axis: string;
  facet?: string;
  kind:
    | 'value_list'
    | 'qualifier'
    | 'relation_target'
    | 'relational_fact'
    | 'coverage_gap'
    | 'workflow_signal'
    | 'guidance_signal';
  layer?: DocumentKnowledgeLayer;
  values: string[];
  subject?: DocumentKnowledgeScopedValue;
  appliesTo?: DocumentKnowledgeScopedValue[];
};

export type DocumentKnowledgeItemMetadata = {
  section?: string;
  parentSection?: string;
  page?: number;
  sheet?: string;
  extractionScope?: DocumentKnowledgeExtractionScope;
  profileKey?: DocumentExtractionProfileId;
  unspecifiedAxes?: string[];
  claim?: DocumentKnowledgeClaimPayload;
};

export type DocumentKnowledgeAxisSummary = {
  axis: string;
  facet?: string;
  values: string[];
  supportClass: DocumentKnowledgeSupportClass;
  layer?: DocumentKnowledgeLayer;
  extractionScope?: DocumentKnowledgeExtractionScope;
  unspecifiedAxes?: string[];
  subject?: DocumentKnowledgeScopedValue;
  appliesTo?: DocumentKnowledgeScopedValue[];
};

export type DocumentKnowledgeMetadataSummary = {
  axis: string;
  facet?: string;
  values: string[];
  supportClass: DocumentKnowledgeSupportClass;
  layer: 'prudence' | 'workflow' | 'guidance';
  extractionScope?: DocumentKnowledgeExtractionScope;
  unspecifiedAxes?: string[];
  subject?: DocumentKnowledgeScopedValue;
  appliesTo?: DocumentKnowledgeScopedValue[];
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
    metadataNotes?: DocumentKnowledgeMetadataSummary[];
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

export type DocumentKnowledgeViewScope = 'active_corpus' | 'document';

export type DocumentKnowledgeProvenance = {
  documentId: string;
  documentTitle: string;
  sourceName?: string | null;
  originKind: DocumentOriginKind;
  chunkSequence: number;
  section?: string;
  page?: number;
  sheet?: string;
  evidenceTextSpan: string;
};

export type DocumentKnowledgeClaimView = {
  axis: string;
  facet?: string;
  layer: 'factual';
  supportClass: DocumentKnowledgeSupportClass;
  extractionScope?: DocumentKnowledgeExtractionScope;
  subject?: DocumentKnowledgeScopedValue;
  appliesTo: DocumentKnowledgeScopedValue[];
  values: string[];
  unspecifiedAxes: string[];
  provenance: DocumentKnowledgeProvenance[];
};

export type DocumentKnowledgeMetadataView = {
  axis: string;
  facet?: string;
  layer: 'prudence' | 'workflow' | 'guidance';
  supportClass: DocumentKnowledgeSupportClass;
  extractionScope?: DocumentKnowledgeExtractionScope;
  subject?: DocumentKnowledgeScopedValue;
  appliesTo: DocumentKnowledgeScopedValue[];
  values: string[];
  unspecifiedAxes: string[];
  provenance: DocumentKnowledgeProvenance[];
};

export type DocumentKnowledgeEntityView = {
  label: string;
  extractionScope?: DocumentKnowledgeExtractionScope;
  values: string[];
  provenance: DocumentKnowledgeProvenance[];
};

export type DocumentKnowledgeView = {
  scope: DocumentKnowledgeViewScope;
  generatedAt: string;
  documents: Array<{
    id: string;
    title: string;
    status: ManagedResourceStatus;
    ingestionStatus: DocumentIngestionStatus;
    language?: string | null;
    sourceName?: string | null;
    corpusRole?: DocumentCorpusRole;
    corpusLayers?: DocumentKnowledgeLayer[];
    updatedAt: string;
  }>;
  counts: {
    documentCount: number;
    chunkCount: number;
    claimCount: number;
    entityCount: number;
  };
  support: {
    topics: string[];
    supportedAxes: string[];
    unspecifiedAxes: string[];
  };
  extractionProfiles: Array<{
    profileId: DocumentExtractionProfileId;
    locale: string;
    tenantDerivedApplied: boolean;
    derivedHints: DocumentExtractionProfileDerivedHints | null;
    derivedFromDocuments: Array<{
      documentId: string;
      title: string;
      updatedAt: string;
    }>;
    sources: {
      axes: Record<string, DocumentExtractionProfileConfigSource>;
      matchingHints: Record<string, DocumentExtractionProfileConfigSource>;
      derivedHints: DocumentExtractionProfileConfigSource;
    };
  }>;
  overviewLines: string[];
  claims: DocumentKnowledgeClaimView[];
  prudenceNotes: DocumentKnowledgeMetadataView[];
  workflowNotes: DocumentKnowledgeMetadataView[];
  guidanceNotes: DocumentKnowledgeMetadataView[];
  entities: DocumentKnowledgeEntityView[];
};
