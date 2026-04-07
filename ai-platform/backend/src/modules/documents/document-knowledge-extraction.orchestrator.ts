import { Injectable } from '@nestjs/common';
import { DocumentOriginKind } from '@prisma/client';

import { buildDocumentChunkBoundaryMetadata } from './document-chunk-boundary';
import { buildKnowledgeRetrievalProjection } from './document-knowledge-claims';
import { buildKnowledgePropositionRetrievalProjection } from './document-knowledge-propositions';
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
  DocumentKnowledgePropositionCandidate,
  DocumentKnowledgePropositionSeed,
  DocumentSemanticBlock,
} from './document.types';

type SupportSummary = {
  topic: string;
  supportedAxes: string[];
  unspecifiedAxes: string[];
};

type SemanticHeading = {
  heading: string;
  depth: number;
  kind: 'numbered' | 'suffix' | 'uppercase' | 'standalone';
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
      const structuredOutput = this.extractStructuredItems(block, {
        profiles: activeProfiles,
        context,
      });
      const structuredItems = structuredOutput.items;
      const structuredPropositions = structuredOutput.propositions;
      const supportSummary = this.buildSupportSummary(block, structuredItems);
      const boundaryMetadata = buildDocumentChunkBoundaryMetadata(block.content);
      const metadata = cleanDocumentKnowledgeRecord({
        ...boundaryMetadata,
        characterLength: block.content.length,
        section: block.section,
        parentSection: block.parentSection,
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
          structuredPropositions,
        }),
        metadata: metadata ?? undefined,
        structuredItems,
        structuredPropositions,
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
      return {
        items: [],
        propositions: [],
      };
    }

    const sentences = splitDocumentSemanticSentences(block.content);
    const supportMetadata = buildSupportMetadata(block);
    const outputs = input.profiles.map((profile) =>
      profile.extractChunk({
        chunk: block,
        sentences,
        context: input.context,
      }),
    );
    const items = outputs.flatMap((output) => output.items);
    const propositions = outputs.flatMap((output) => output.propositions ?? []);

    return {
      items: dedupeStructuredItems(items).map((item, sequence) => ({
        ...item,
        sequence,
        metadata:
          cleanDocumentKnowledgeRecord({
            ...supportMetadata,
            ...(item.metadata ?? {}),
          }) ?? undefined,
      })),
      propositions: dedupeStructuredPropositions(propositions).map(
        (proposition, sequence) => ({
          ...proposition,
          sequence,
          metadata:
            cleanDocumentKnowledgeRecord({
              ...supportMetadata,
              ...(proposition.metadata ?? {}),
            }) ?? undefined,
        }),
      ),
    };
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
  const headingStack: SemanticHeading[] = [];
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
      parentSection: bufferMeta.parentSection,
      page: bufferMeta.page,
      sheet: bufferMeta.sheet,
    });
    buffer = '';
    bufferMeta = {};
  };

  const resolveCurrentHeadingMeta = () => {
    const current = headingStack[headingStack.length - 1];
    const parent = headingStack.length > 1 ? headingStack[headingStack.length - 2] : undefined;

    return {
      section: current?.heading,
      parentSection: parent?.heading,
    };
  };

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const normalizedParagraph = stripDividerLines(paragraph).trim();
    const nextParagraph = resolveNextMeaningfulParagraph(paragraphs, index);

    if (!normalizedParagraph) {
      continue;
    }

    const firstMeaningfulLine = getMeaningfulLines(paragraph)[0];

    if (!firstMeaningfulLine) {
      continue;
    }

    const pageMatch = firstMeaningfulLine.match(
      documentKnowledgeExtractionCatalog.patterns.page,
    );

    if (pageMatch?.[1]) {
      flushBuffer();
      currentPage = Number(pageMatch[1]);
      continue;
    }

    const sheetMatch = firstMeaningfulLine.match(
      documentKnowledgeExtractionCatalog.patterns.sheet,
    );

    if (sheetMatch?.[1]) {
      flushBuffer();
      currentSheet = sheetMatch[1].trim();
      headingStack.splice(0, headingStack.length, {
        heading: currentSheet,
        depth: 1,
        kind: 'uppercase',
      });
      continue;
    }

    const heading = resolveSemanticHeading(
      paragraph,
      headingStack[headingStack.length - 1],
      nextParagraph,
    );

    if (heading) {
      const paragraphBody = removeHeadingLead(paragraph, heading.heading);

      flushBuffer();
      headingStack.splice(heading.depth - 1);
      headingStack.push(heading);
      const currentHeadingMeta = resolveCurrentHeadingMeta();

      if (!paragraphBody) {
        continue;
      }

      const nextMeta = {
        section: currentHeadingMeta.section,
        parentSection:
          currentHeadingMeta.parentSection &&
          currentHeadingMeta.parentSection !== currentHeadingMeta.section
            ? currentHeadingMeta.parentSection
            : undefined,
        page: currentPage,
        sheet: currentSheet,
      };

      if (paragraphBody.length <= 900) {
        buffer = paragraphBody;
        bufferMeta = nextMeta;
        continue;
      }

      for (const sentenceChunk of splitOversizedParagraph(paragraphBody)) {
        blocks.push({
          content: sentenceChunk,
          ...nextMeta,
        });
      }

      continue;
    }

    const currentHeadingMeta = resolveCurrentHeadingMeta();
    const nextCandidate =
      buffer.length > 0 ? `${buffer}\n\n${normalizedParagraph}` : normalizedParagraph;
    const nextMeta = {
      section: currentHeadingMeta.section,
      parentSection:
        currentHeadingMeta.parentSection &&
        currentHeadingMeta.parentSection !== currentHeadingMeta.section
          ? currentHeadingMeta.parentSection
          : undefined,
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

    if (normalizedParagraph.length <= 900) {
      buffer = normalizedParagraph;
      bufferMeta = nextMeta;
      continue;
    }

    for (const sentenceChunk of splitOversizedParagraph(normalizedParagraph)) {
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
    parentSection: block.parentSection,
    page: block.page,
    sheet: block.sheet,
  }) ?? {};
}

function buildRetrievalProjection(input: {
  block: DocumentSemanticBlock;
  supportSummary: SupportSummary;
  structuredItems: DocumentKnowledgeItemCandidate[];
  structuredPropositions?: DocumentKnowledgePropositionCandidate[];
}) {
  return [
    buildKnowledgeRetrievalProjection({
      topic: input.supportSummary.topic,
      supportedAxes: input.supportSummary.supportedAxes,
      unspecifiedAxes: input.supportSummary.unspecifiedAxes,
      section: input.block.section,
      items: input.structuredItems,
    }),
    buildKnowledgePropositionRetrievalProjection({
      propositions: (input.structuredPropositions ?? []).map((item) => ({
        predicate: item.proposition.predicate,
        facet: item.proposition.facet,
        objectValue: item.proposition.objectValue,
        objectNormalized: item.proposition.objectNormalizedValue,
        relationScope: item.proposition.relationScope,
        metadata: item.metadata,
      })),
    }),
  ]
    .filter((value) => value.trim().length > 0)
    .join(' ')
    .trim();
}

function resolveSupportTopic(block: DocumentSemanticBlock) {
  if (block.parentSection && block.section) {
    return `${block.parentSection} / ${block.section}`;
  }

  if (block.section) {
    return block.section;
  }

  const firstSentence =
    splitDocumentSemanticSentences(block.content)[0] ?? block.content;
  return firstSentence.slice(0, 120).trim();
}

function resolveSemanticHeading(
  paragraph: string,
  currentHeading?: SemanticHeading,
  nextParagraph?: string,
) {
  const firstLine = getMeaningfulLines(paragraph)[0];

  if (!firstLine) {
    return undefined;
  }

  if (/^\d+(?:\.\d+)*\.?\s+\S+/u.test(firstLine) && firstLine.length <= 120) {
    return {
      heading: firstLine.trim(),
      depth: resolveNumberedHeadingDepth(firstLine),
      kind: 'numbered',
    } satisfies SemanticHeading;
  }

  if (documentKnowledgeExtractionCatalog.patterns.headingSuffix.test(firstLine)) {
    const parentDepth = currentHeading?.depth ?? 0;
    const depth =
      currentHeading?.kind === 'suffix' ? Math.max(1, parentDepth) : Math.max(1, parentDepth + 1);

    return {
      heading: firstLine.replace(/:$/u, '').trim(),
      depth,
      kind: 'suffix',
    } satisfies SemanticHeading;
  }

  if (
    firstLine.length <= 80 &&
    documentKnowledgeExtractionCatalog.patterns.headingUppercase.test(firstLine) &&
    !documentKnowledgeExtractionCatalog.patterns.divider.test(firstLine) &&
    firstLine.split(/\s+/u).length <= 8
  ) {
    return {
      heading: firstLine.trim(),
      depth: 1,
      kind: 'uppercase',
    } satisfies SemanticHeading;
  }

  if (looksLikeStandaloneHeading(paragraph, firstLine, nextParagraph)) {
    const parentDepth = currentHeading?.depth ?? 0;
    const depth =
      currentHeading?.kind === 'suffix' || currentHeading?.kind === 'standalone'
        ? Math.max(1, parentDepth)
        : Math.max(1, parentDepth + 1);

    return {
      heading: firstLine.trim(),
      depth,
      kind: 'standalone',
    } satisfies SemanticHeading;
  }

  return undefined;
}

function removeHeadingLead(paragraph: string, heading: string) {
  const lines = paragraph
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !documentKnowledgeExtractionCatalog.patterns.divider.test(line),
    );

  const firstLine = lines[0]?.replace(/:$/u, '').trim();

  if (firstLine !== heading) {
    return '';
  }

  return lines.slice(1).join('\n').trim();
}

function getMeaningfulLines(paragraph: string) {
  return paragraph
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !documentKnowledgeExtractionCatalog.patterns.divider.test(line),
    );
}

function stripDividerLines(paragraph: string) {
  return paragraph
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !documentKnowledgeExtractionCatalog.patterns.divider.test(line))
    .join('\n');
}

function resolveNumberedHeadingDepth(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)*)\.?\s+/u);

  if (!match?.[1]) {
    return 1;
  }

  return match[1].split('.').length;
}

function looksLikeStandaloneHeading(
  paragraph: string,
  firstLine: string,
  nextParagraph?: string,
) {
  const meaningfulLines = getMeaningfulLines(paragraph);
  const normalizedLine = firstLine.trim();

  if (meaningfulLines.length !== 1) {
    return false;
  }

  if (
    !normalizedLine ||
    normalizedLine.length > 90 ||
    documentKnowledgeExtractionCatalog.patterns.divider.test(normalizedLine) ||
    /^\s*[-•]/u.test(normalizedLine) ||
    /:\s+\S+/u.test(normalizedLine) ||
    /[.;!?]$/u.test(normalizedLine)
  ) {
    return false;
  }

  const tokenCount = normalizedLine
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean).length;

  if (tokenCount === 0 || tokenCount > 8) {
    return false;
  }

  const lowerCased = normalizedLine.toLocaleLowerCase();

  const conditionalLead =
    lowerCased.startsWith('si ') ||
    lowerCased.startsWith('cuando ') ||
    lowerCased.startsWith('para ') ||
    lowerCased.startsWith('por ');

  if (conditionalLead && !looksLikeStructuredListParagraph(nextParagraph)) {
    return false;
  }

  return /^[\p{L}\p{N}][\p{L}\p{N}\s\-\/()+,:]+$/u.test(normalizedLine);
}

function resolveNextMeaningfulParagraph(paragraphs: string[], currentIndex: number) {
  for (let index = currentIndex + 1; index < paragraphs.length; index += 1) {
    const normalizedParagraph = stripDividerLines(paragraphs[index]).trim();

    if (normalizedParagraph.length > 0) {
      return normalizedParagraph;
    }
  }

  return undefined;
}

function looksLikeStructuredListParagraph(paragraph?: string) {
  if (!paragraph) {
    return false;
  }

  const meaningfulLines = getMeaningfulLines(paragraph);

  if (meaningfulLines.length === 0) {
    return false;
  }

  return meaningfulLines.every(
    (line) =>
      /^\s*[-•]/u.test(line) ||
      /^[^:]{1,80}:\s+\S+/u.test(line),
  );
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

function dedupeStructuredPropositions(
  propositions: DocumentKnowledgePropositionSeed[],
) {
  const seen = new Set<string>();

  return propositions.filter((proposition) => {
    const key = [
      proposition.proposition.canonicalKey,
      proposition.label,
      proposition.supportClass,
      proposition.metadata?.profileKey ?? '',
      proposition.metadata?.section ?? '',
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
