import { Injectable } from '@nestjs/common';
import { DocumentOriginKind } from '@prisma/client';

import { buildDocumentChunkBoundaryMetadata } from './document-chunk-boundary';
import {
  buildClaimValueText,
  buildKnowledgeRetrievalProjection,
} from './document-knowledge-claims';
import {
  documentKnowledgeExtractionCatalog,
  normalizeOperationModeTerm,
} from './document-knowledge-extraction.catalogs';
import {
  DocumentChunkCandidate,
  DocumentKnowledgeClaimPayload,
  DocumentKnowledgeExtractionScope,
  DocumentKnowledgeItemCandidate,
  DocumentKnowledgeItemMetadata,
} from './document.types';

type SemanticBlock = {
  content: string;
  section?: string;
  page?: number;
  sheet?: string;
};

type SupportSummary = {
  topic: string;
  supportedAxes: string[];
  unspecifiedAxes: string[];
};

@Injectable()
export class DocumentKnowledgeExtractionService {
  buildChunkCandidates(input: {
    sourceText: string;
    originKind: DocumentOriginKind;
    language?: string | null;
    sourceMetadata?: Record<string, unknown> | null;
  }): DocumentChunkCandidate[] {
    const blocks = buildSemanticBlocks(input.sourceText, input.sourceMetadata);

    return blocks.map((block, index) => {
      const structuredItems = this.extractStructuredItems(block);
      const supportSummary = this.buildSupportSummary(block, structuredItems);
      const boundaryMetadata = buildDocumentChunkBoundaryMetadata(block.content);
      const metadata = cleanRecord({
        ...boundaryMetadata,
        characterLength: block.content.length,
        section: block.section,
        page: block.page,
        sheet: block.sheet,
        originKind: input.originKind,
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

  private extractStructuredItems(block: SemanticBlock) {
    const items: DocumentKnowledgeItemCandidate[] = [];
    let sequence = 0;
    const sentences = splitSemanticSentences(block.content);

    for (const sentence of sentences) {
      const supportMetadata = buildSupportMetadata(block);
      const productTypes = this.extractProductTypeClaim(sentence, sequence, supportMetadata);

      if (productTypes.length > 0) {
        items.push(...productTypes);
        sequence += productTypes.length;
      }

      const materials = this.extractMaterialsClaim(sentence, sequence, supportMetadata);

      if (materials.length > 0) {
        items.push(...materials);
        sequence += materials.length;
      }

      const operationModes = this.extractOperationModeClaim(
        sentence,
        sequence,
        supportMetadata,
      );

      if (operationModes.length > 0) {
        items.push(...operationModes);
        sequence += operationModes.length;
      }

      const colors = this.extractColorClaim(sentence, sequence, supportMetadata);

      if (colors.length > 0) {
        items.push(...colors);
        sequence += colors.length;
      }

      const suitability = this.extractSuitabilityClaim(
        sentence,
        sequence,
        supportMetadata,
      );

      if (suitability.length > 0) {
        items.push(...suitability);
        sequence += suitability.length;
      }
    }

    return dedupeStructuredItems(items);
  }

  private buildSupportSummary(
    block: SemanticBlock,
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

  private extractProductTypeClaim(
    sentence: string,
    sequence: number,
    metadata: Record<string, unknown>,
  ): DocumentKnowledgeItemCandidate[] {
    const listMatch = sentence.match(
      documentKnowledgeExtractionCatalog.patterns.productTypes,
    );

    if (!listMatch?.[1]) {
      return [];
    }

    const values = splitListValues(listMatch[1]);

    if (values.length < 2) {
      return [];
    }

    return buildClaimWithEntities({
      sequence,
      axis: 'product_types',
      claimKind: 'value_list',
      claimValues: values,
      entityLabel: 'product_type',
      entities: values,
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: withExtractionScope(metadata, 'tenant_only'),
    });
  }

  private extractMaterialsClaim(
    sentence: string,
    sequence: number,
    metadata: Record<string, unknown>,
  ): DocumentKnowledgeItemCandidate[] {
    const normalizedSentence = normalizeSearchText(sentence);
    const materialSource = firstPatternCapture(
      sentence,
      documentKnowledgeExtractionCatalog.patterns.materialListLeads,
    );
    const explicitValues = Array.from(
      new Set(
        splitListValues(materialSource)
          .map((value) => value.replace(/[.;]+$/u, '').trim())
          .filter((value) => value.length > 1)
          .filter((value) => !normalizedSentence.includes(`colores ${normalizeSearchText(value)}`)),
      ),
    );

    if (explicitValues.length === 0) {
      return [];
    }

    return buildClaimWithEntities({
      sequence,
      axis: 'materials',
      claimKind: 'value_list',
      claimValues: explicitValues,
      entityLabel: 'material',
      entities: explicitValues,
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: withExtractionScope(metadata, 'tenant_only'),
    });
  }

  private extractOperationModeClaim(
    sentence: string,
    sequence: number,
    metadata: Record<string, unknown>,
  ): DocumentKnowledgeItemCandidate[] {
    const normalizedSentence = normalizeSearchText(sentence);
    const values = Array.from(
      new Set(
        documentKnowledgeExtractionCatalog.operationModeTerms
          .filter((term) => normalizedSentence.includes(normalizeSearchText(term)))
          .map(normalizeOperationModeTerm),
      ),
    );

    if (values.length === 0) {
      return [];
    }

    return buildClaimWithEntities({
      sequence,
      axis: 'operation_modes',
      claimKind: 'value_list',
      claimValues: values,
      entityLabel: 'operation_mode',
      entities: values,
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: withExtractionScope(metadata, 'core'),
    });
  }

  private extractColorClaim(
    sentence: string,
    sequence: number,
    metadata: Record<string, unknown>,
  ): DocumentKnowledgeItemCandidate[] {
    const normalizedSentence = normalizeSearchText(sentence);

    if (
      documentKnowledgeExtractionCatalog.patterns.colorVariety.some((value) =>
        normalizedSentence.includes(normalizeSearchText(value)),
      )
    ) {
      return [
        {
          sequence,
          kind: 'claim',
          label: 'color_options',
          valueText: 'variety',
          normalizedValue: 'color variety',
          supportClass: 'partial_fact',
          evidenceTextSpan: sentence,
          metadata:
            cleanRecord({
              ...withExtractionScope(metadata, 'core'),
              unspecifiedAxes: ['exact_color_options'],
              claim: {
                axis: 'color_options',
                kind: 'qualifier',
                values: ['variety'],
              } satisfies DocumentKnowledgeClaimPayload,
            }) ?? undefined,
        },
      ];
    }

    const colorListMatch = sentence.match(
      documentKnowledgeExtractionCatalog.patterns.colorList,
    );

    if (!colorListMatch?.[1]) {
      return [];
    }

    const values = splitListValues(colorListMatch[1]);

    if (values.length === 0) {
      return [];
    }

    return buildClaimWithEntities({
      sequence,
      axis: 'color_options',
      claimKind: 'value_list',
      claimValues: values,
      entityLabel: 'color',
      entities: values,
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: withExtractionScope(metadata, 'tenant_only'),
    });
  }

  private extractSuitabilityClaim(
    sentence: string,
    sequence: number,
    metadata: Record<string, unknown>,
  ): DocumentKnowledgeItemCandidate[] {
    const match = sentence.match(
      documentKnowledgeExtractionCatalog.patterns.suitability,
    );

    if (!match?.[1]) {
      return [];
    }

    const cleaned = match[1].trim().replace(/[.;]+$/u, '');

    if (!cleaned) {
      return [];
    }

    return [
      {
        sequence,
        kind: 'claim',
        label: 'suitability',
        valueText: cleaned,
        normalizedValue: normalizeSearchText(cleaned),
        supportClass: 'bounded_inference',
        evidenceTextSpan: sentence,
        metadata:
          cleanRecord({
            ...withExtractionScope(metadata, 'core'),
            claim: {
              axis: 'suitability',
              kind: 'relation_target',
              values: [cleaned],
            } satisfies DocumentKnowledgeClaimPayload,
          }) ?? undefined,
      },
    ];
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
  const blocks: SemanticBlock[] = [];
  let currentSection: string | undefined;
  let currentPage: number | undefined;
  let currentSheet: string | undefined =
    Array.isArray(sourceMetadata?.sheetNames) &&
    sourceMetadata.sheetNames.length === 1 &&
    typeof sourceMetadata.sheetNames[0] === 'string'
      ? sourceMetadata.sheetNames[0]
      : undefined;
  let buffer = '';
  let bufferMeta: Omit<SemanticBlock, 'content'> = {};

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

function buildSupportMetadata(block: SemanticBlock) {
  return cleanRecord({
    section: block.section,
    page: block.page,
    sheet: block.sheet,
  }) ?? {};
}

function buildClaimWithEntities(input: {
  sequence: number;
  axis: string;
  claimKind: DocumentKnowledgeClaimPayload['kind'];
  claimValues: string[];
  entityLabel: string;
  entities: string[];
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  evidenceTextSpan: string;
  metadata: DocumentKnowledgeItemMetadata;
}) {
  const normalizedClaimValues = input.claimValues
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const items: DocumentKnowledgeItemCandidate[] = [
    {
      sequence: input.sequence,
      kind: 'claim',
      label: input.axis,
      valueText: buildClaimValueText(normalizedClaimValues),
      normalizedValue: normalizeSearchText(normalizedClaimValues.join(' ')),
      supportClass: input.supportClass,
      evidenceTextSpan: input.evidenceTextSpan,
      metadata:
        cleanRecord({
          ...input.metadata,
          claim: {
            axis: input.axis,
            kind: input.claimKind,
            values: normalizedClaimValues,
          } satisfies DocumentKnowledgeClaimPayload,
        }) ?? undefined,
    },
  ];

  input.entities.forEach((entity, index) => {
    items.push({
      sequence: input.sequence + index + 1,
      kind: 'entity',
      label: input.entityLabel,
      valueText: entity,
      normalizedValue: normalizeSearchText(entity),
      supportClass: input.supportClass,
      evidenceTextSpan: input.evidenceTextSpan,
      metadata: input.metadata,
    });
  });

  return items;
}

function firstPatternCapture(value: string, patterns: readonly RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
}

function buildRetrievalProjection(input: {
  block: SemanticBlock;
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

function withExtractionScope(
  metadata: Record<string, unknown>,
  scope: DocumentKnowledgeExtractionScope,
): DocumentKnowledgeItemMetadata {
  return cleanRecord({
    ...metadata,
    extractionScope: scope,
  }) ?? {};
}

function resolveSupportTopic(block: SemanticBlock) {
  if (block.section) {
    return block.section;
  }

  const firstSentence = splitSemanticSentences(block.content)[0] ?? block.content;
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
  const sentences = splitSemanticSentences(paragraph);
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

function splitSemanticSentences(value: string) {
  return value
    .split(/\n{2,}|(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function splitListValues(value: string) {
  const truncated = value
    .replace(documentKnowledgeExtractionCatalog.patterns.oversizedClaimTail, '')
    .replace(/[.;]+$/u, '')
    .trim();

  return truncated
    .replace(/\s+y\s+/giu, ', ')
    .split(/\s*[|,/]\s*|\s+-\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 8);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function cleanRecord<T extends Record<string, unknown>>(value: T | null | undefined) {
  if (!value) {
    return null;
  }

  const entries = Object.entries(value).filter(([, current]) => {
    if (current === undefined || current === null) {
      return false;
    }

    if (typeof current === 'string') {
      return current.trim().length > 0;
    }

    if (Array.isArray(current)) {
      return current.length > 0;
    }

    return true;
  });

  return entries.length > 0 ? (Object.fromEntries(entries) as T) : null;
}

function dedupeBlocks(blocks: SemanticBlock[]) {
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

function dedupeStructuredItems(items: DocumentKnowledgeItemCandidate[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      item.kind,
      item.label,
      item.normalizedValue ?? normalizeSearchText(item.valueText),
      item.supportClass,
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
