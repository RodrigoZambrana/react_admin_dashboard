import { DocumentOriginKind } from '@prisma/client';
import type { DocumentKnowledgeItemSeed, DocumentSemanticBlock } from './document.types';

export const documentExtractionProfileIds = ['product_catalog'] as const;
export type DocumentExtractionProfileId =
  (typeof documentExtractionProfileIds)[number];

export type DocumentExtractionContext = {
  tenantId?: string | null;
  locale?: string | null;
  originKind: DocumentOriginKind;
  resourceType?: string | null;
  activeCapabilities?: string[];
  sourceMetadata?: Record<string, unknown> | null;
};

export type DocumentExtractionProfileInput = {
  chunk: DocumentSemanticBlock;
  sentences: string[];
  context: DocumentExtractionContext;
};

export interface DocumentExtractionProfile {
  id: DocumentExtractionProfileId;
  supports(context: DocumentExtractionContext): boolean;
  extractChunk(input: DocumentExtractionProfileInput): DocumentKnowledgeItemSeed[];
}
