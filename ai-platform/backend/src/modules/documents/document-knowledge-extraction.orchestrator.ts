import { Injectable } from '@nestjs/common';
import { DocumentOriginKind } from '@prisma/client';

import { buildDocumentChunkBoundaryMetadata } from './document-chunk-boundary';
import { buildKnowledgeRetrievalProjection } from './document-knowledge-claims';
import { documentKnowledgeExtractionCatalog } from './document-knowledge-extraction.catalogs';
import {
  DocumentExtractionContext,
  DocumentExtractionProfile,
} from './document-extraction-profile.types';
import { DocumentExtractionProfileResolverService } from './document-extraction-profile-resolver.service';
import {
  cleanDocumentKnowledgeRecord,
  normalizeDocumentKnowledgeText,
  splitDocumentSemanticSentences,
} from './document-knowledge-extraction.utils';
import {
  DocumentChunkCandidate,
  DocumentKnowledgeItemCandidate,
  DocumentKnowledgeItemSeed,
  DocumentSemanticBlock,
} from './document.types';

type SupportSummary = {
  topic: string;
  supportedAxes: string[];
  unspecifiedAxes: string[];
};

@Injectable()
export class DocumentKnowledgeExtractionOrchestrator {
  constructor(
    private readonly profileResolver: DocumentExtractionProfileResolverService = new DocumentExtractionProfileResolverService(),
  ) {}

  buildChunkCandidates(input: {
    sourceText: string;
    originKind: DocumentOriginKind;
    language?: string | null;
    sourceMetadata?: Record<string, unknown> | null;
    extractionContext?: Partial<DocumentExtractionContext>;
  }): DocumentChunkCandidate[] {
    const context = this.buildExtractionContext(input);
    const activeProfiles = this.profileResolver.resolveProfiles(context);
    const activeProfileIds = activeProfiles.map((profile) => profile.id);
    const blocks = buildSemanticBlocks(input.sourceText, input.sourceMetadata);

    return blocks.map((block, index) => {
      const structuredItems = this.extractStructuredItems(block, {
        profiles: activeProfiles,
        context,
      });
      const supportSummary = this.buildSupportSummary(block, structuredItems);
      const boundaryMetadata = buildDocumentChunkBoundaryMetadata(block.content);
      const metadata = cleanDocumentKnowledgeRecord({
        ...boundaryMetadata,
        characterLength: block.content.length,
        section: block.section,
        page: block.page,
        sheet: block.sheet,
        originKind: input.originKind,
        extractionProfiles: activeProfileIds,
        supportSummary,
        sourceMetadata: input.sourceMetadata ?? undefined,
      });

      return {
        sequence: index,
        content: block.content,
        searchText: normalizeSearchText(block.content),
        retrievalProjection: buildRetrievalProjection({
          block,
          supportSummary,
          structuredItems,
        }),
        metadata: metadata ?? undefined,
        structuredItems,
      };
    });
  }

  private buildExtractionContext(input: {
    originKind: DocumentOriginKind;
    language?: string | null;
    sourceMetadata?: Record<string, unknown> | null;
    extractionContext?: Partial<DocumentExtractionContext>;
  }): DocumentExtractionContext {
    return {
      tenantId: input.extractionContext?.tenantId ?? null,
      locale: input.extractionContext?.locale ?? input.language ?? null,
      originKind: input.originKind,
      resourceType:
        input.extractionContext?.resourceType ??
        resolveResourceType(input.sourceMetadata),
      activeCapabilities: input.extractionContext?.activeCapabilities ?? [],
      sourceMetadata: input.sourceMetadata ?? null,
      profileConfigHints: input.extractionContext?.profileConfigHints ?? {},
    };
  }

  private extractStructuredItems(
    block: DocumentSemanticBlock,
    input: {
      profiles: DocumentExtractionProfile[];
      context: DocumentExtractionContext;
    },
  ) {
    if (input.profiles.length === 0) {
      return [];
    }

    const sentences = splitDocumentSemanticSentences(block.content);
    const supportMetadata = buildSupportMetadata(block);
    const items = input.profiles.flatMap((profile) =>
      profile.extractChunk({
        chunk: block,
        sentences,
        context: input.context,
      }),
    );

    return dedupeStructuredItems(items).map((item, sequence) => ({
      ...item,
      sequence,
      metadata:
        cleanDocumentKnowledgeRecord({
          ...supportMetadata,
          ...(item.metadata ?? {}),
        }) ?? undefined,
    }));
  }

  private buildSupportSummary(
    block: DocumentSemanticBlock,
    items: DocumentKnowledgeItemCandidate[],
  ): SupportSummary {
    const supportedAxes = Array.from(
      new Set(
        items
          .filter((item) => item.kind === 'claim')
          .map((item) => item.label)
          .filter(Boolean),
      ),
    );
    const unspecifiedAxes = Array.from(
      new Set(
        items
          .flatMap((item) =>
            Array.isArray(item.metadata?.unspecifiedAxes)
              ? item.metadata?.unspecifiedAxes
              : [],
          )
          .filter((value): value is string => typeof value === 'string'),
      ),
    );

    return {
      topic: resolveSupportTopic(block),
      supportedAxes,
      unspecifiedAxes,
    };
  }
}

function buildSemanticBlocks(
  sourceText: string,
  sourceMetadata?: Record<string, unknown> | null,
) {
  const paragraphs = sourceText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const blocks: DocumentSemanticBlock[] = [];
  let currentSection: string | undefined;
  let currentPage: number | undefined;
  let currentSheet: string | undefined =
    Array.isArray(sourceMetadata?.sheetNames) &&
    sourceMetadata.sheetNames.length === 1 &&
    typeof sourceMetadata.sheetNames[0] === 'string'
      ? sourceMetadata.sheetNames[0]
      : undefined;
  let buffer = '';
  let bufferMeta: Omit<DocumentSemanticBlock, 'content'> = {};

  const flushBuffer = () => {
    const content = buffer.trim();

    if (!content) {
      return;
    }

    blocks.push({
      content,
      section: bufferMeta.section,
      page: bufferMeta.page,
      sheet: bufferMeta.sheet,
    });
    buffer = '';
  };

  for (const paragraph of paragraphs) {
    const pageMatch = paragraph.match(documentKnowledgeExtractionCatalog.patterns.page);

    if (pageMatch?.[1]) {
      flushBuffer();
      currentPage = Number(pageMatch[1]);
      continue;
    }

    const sheetMatch = paragraph.match(
      documentKnowledgeExtractionCatalog.patterns.sheet,
    );

    if (sheetMatch?.[1]) {
      flushBuffer();
      currentSheet = sheetMatch[1].trim();
      currentSection = currentSheet;
      continue;
    }

    const heading = resolveSemanticHeading(paragraph);

    if (heading && paragraph.length <= 120) {
      flushBuffer();
      currentSection = heading;
      continue;
    }

    const nextCandidate = buffer.length > 0 ? `${buffer}\n\n${paragraph}` : paragraph;
    const nextMeta = {
      section: currentSection,
      page: currentPage,
      sheet: currentSheet,
    };

    if (
      buffer.length > 0 &&
      nextCandidate.length <= 900 &&
      bufferMeta.section === nextMeta.section &&
      bufferMeta.page === nextMeta.page &&
      bufferMeta.sheet === nextMeta.sheet
    ) {
      buffer = nextCandidate;
      continue;
    }

    if (buffer.length > 0) {
      flushBuffer();
    }

    if (paragraph.length <= 900) {
      buffer = paragraph;
      bufferMeta = nextMeta;
      continue;
    }

    for (const sentenceChunk of splitOversizedParagraph(paragraph)) {
      blocks.push({
        content: sentenceChunk,
        ...nextMeta,
      });
    }
  }

  flushBuffer();

  return dedupeBlocks(blocks);
}

function buildSupportMetadata(block: DocumentSemanticBlock) {
  return cleanDocumentKnowledgeRecord({
    section: block.section,
    page: block.page,
    sheet: block.sheet,
  }) ?? {};
}

function buildRetrievalProjection(input: {
  block: DocumentSemanticBlock;
  supportSummary: SupportSummary;
  structuredItems: DocumentKnowledgeItemCandidate[];
}) {
  return buildKnowledgeRetrievalProjection({
    topic: input.supportSummary.topic,
    supportedAxes: input.supportSummary.supportedAxes,
    unspecifiedAxes: input.supportSummary.unspecifiedAxes,
    section: input.block.section,
    items: input.structuredItems,
  });
}

function resolveSupportTopic(block: DocumentSemanticBlock) {
  if (block.section) {
    return block.section;
  }

  const firstSentence =
    splitDocumentSemanticSentences(block.content)[0] ?? block.content;
  return firstSentence.slice(0, 120).trim();
}

function resolveSemanticHeading(paragraph: string) {
  const firstLine = paragraph
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return undefined;
  }

  if (documentKnowledgeExtractionCatalog.patterns.headingSuffix.test(firstLine)) {
    return firstLine.replace(/:$/u, '').trim();
  }

  if (
    firstLine.length <= 80 &&
    documentKnowledgeExtractionCatalog.patterns.headingUppercase.test(firstLine) &&
    firstLine.split(/\s+/u).length <= 8
  ) {
    return firstLine.trim();
  }

  return undefined;
}

function splitOversizedParagraph(paragraph: string) {
  const sentences = splitDocumentSemanticSentences(paragraph);
  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    const candidate = buffer.length > 0 ? `${buffer} ${sentence}` : sentence;

    if (candidate.length <= 900) {
      buffer = candidate;
      continue;
    }

    if (buffer.length > 0) {
      chunks.push(buffer.trim());
    }

    buffer = sentence;
  }

  if (buffer.length > 0) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

function normalizeSearchText(value: string) {
  return normalizeDocumentKnowledgeText(value);
}

function dedupeBlocks(blocks: DocumentSemanticBlock[]) {
  const seen = new Set<string>();

  return blocks.filter((block) => {
    const normalized = normalizeSearchText(block.content);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function dedupeStructuredItems(items: DocumentKnowledgeItemSeed[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      item.kind,
      item.label,
      item.normalizedValue ?? normalizeSearchText(item.valueText),
      item.supportClass,
      item.metadata?.profileKey ?? '',
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function resolveResourceType(sourceMetadata?: Record<string, unknown> | null) {
  if (
    typeof sourceMetadata?.resourceType === 'string' &&
    sourceMetadata.resourceType.trim().length > 0
  ) {
    return sourceMetadata.resourceType.trim();
  }

  return null;
}
