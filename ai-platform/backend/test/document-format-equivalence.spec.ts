import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DocumentKnowledgeClaimPayload,
  DocumentKnowledgeItemCandidate,
} from '../src/modules/documents/document.types';
import { DocumentContentExtractorService } from '../src/modules/documents/document-content-extractor.service';
import { DocumentKnowledgeExtractionService } from '../src/modules/documents/document-knowledge-extraction.service';
import { StructuredCatalogUploadAdapter } from '../src/modules/tenant-resources/structured-catalog-upload.adapter';
import { UploadDocxDocumentAdapter } from '../src/modules/tenant-resources/upload-docx-document.adapter';
import { UploadPdfDocumentAdapter } from '../src/modules/tenant-resources/upload-pdf-document.adapter';
import { UploadTextDocumentAdapter } from '../src/modules/tenant-resources/upload-text-document.adapter';
import { UploadXlsxDocumentAdapter } from '../src/modules/tenant-resources/upload-xlsx-document.adapter';
import { UrlDocumentResourceAdapter } from '../src/modules/tenant-resources/url-document-resource.adapter';

type ExtractedSignature = {
  chunkCount: number;
  claimCount: number;
  propositionCount: number;
  commercialPresence: string[];
  paymentMethods: string[];
  installments: string[];
  cards: string[];
  pvcColors: string[];
  aluminumColors: string[];
  visitCost: string[];
  travelCost: string[];
  warranties: string[];
  informativeFlow: string[];
  quoteTransition: string[];
  confirmationPolicy: string[];
  organicResponsePattern: string[];
  comparisonGuidance: string[];
  supportSerie25: string[];
  supportProbba: string[];
};

type ComparableSignatureKey = Exclude<
  keyof ExtractedSignature,
  'chunkCount' | 'claimCount' | 'propositionCount'
>;

const comparableSignatureKeys: ComparableSignatureKey[] = [
  'commercialPresence',
  'paymentMethods',
  'installments',
  'cards',
  'pvcColors',
  'aluminumColors',
  'visitCost',
  'travelCost',
  'warranties',
  'informativeFlow',
  'quoteTransition',
  'confirmationPolicy',
  'organicResponsePattern',
  'comparisonGuidance',
  'supportSerie25',
  'supportProbba',
];

describe('Document format equivalence', () => {
  const fixturesDir = join(__dirname, 'fixtures', 'urucortinas');
  const documentContentExtractor = new DocumentContentExtractorService(
    new UploadTextDocumentAdapter(),
    new UploadDocxDocumentAdapter(),
    new UploadXlsxDocumentAdapter(),
    new UploadPdfDocumentAdapter(),
    new UrlDocumentResourceAdapter(),
    new StructuredCatalogUploadAdapter(),
  );
  const extractionService = new DocumentKnowledgeExtractionService();

  it('keeps the extracted knowledge signature stable across txt, docx, and html versions of the same document', async () => {
    const txt = await buildSignature({
      extractor: documentContentExtractor,
      extractionService,
      fileName: 'urucortinas-documento-maestro-chat-2026-04-05.txt',
      mimeType: 'text/plain',
      fixturesDir,
    });
    const docx = await buildSignature({
      extractor: documentContentExtractor,
      extractionService,
      fileName: 'urucortinas-documento-maestro-chat-2026-04-05.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fixturesDir,
    });
    const html = await buildSignature({
      extractor: documentContentExtractor,
      extractionService,
      fileName: 'urucortinas-documento-maestro-chat-2026-04-05-clean.html',
      mimeType: 'text/html',
      fixturesDir,
    });

    expect(docx.chunkCount).toBeGreaterThanOrEqual(120);
    expect(html.chunkCount).toBeGreaterThanOrEqual(120);
    expect(Math.abs(docx.chunkCount - txt.chunkCount)).toBeLessThanOrEqual(5);
    expect(Math.abs(html.chunkCount - txt.chunkCount)).toBeLessThanOrEqual(5);

    const comparableKeys = resolveComparableKeys([txt, docx, html]);
    const baselineComparable = projectComparableSignature(txt, comparableKeys);

    expect(projectComparableSignature(docx, comparableKeys)).toEqual(
      baselineComparable,
    );
    expect(projectComparableSignature(html, comparableKeys)).toEqual(
      baselineComparable,
    );
  });
});

async function buildSignature(input: {
  extractor: DocumentContentExtractorService;
  extractionService: DocumentKnowledgeExtractionService;
  fixturesDir: string;
  fileName: string;
  mimeType: string;
}): Promise<ExtractedSignature> {
  const buffer = readFileSync(join(input.fixturesDir, input.fileName));
  const extracted = await input.extractor.extractFromUpload({
    originalName: input.fileName,
    mimeType: input.mimeType,
    buffer,
    language: 'es',
  });
  const chunks = input.extractionService.buildChunkCandidates({
    sourceText: extracted.content,
    originKind: 'UPLOAD',
    sourceMetadata: {
      sourceName: input.fileName,
    },
    extractionContext: {
      activeCapabilities: ['product_catalog_lookup'],
      locale: 'es',
    },
  });
  const claims = chunks
    .flatMap((chunk) => chunk.structuredItems ?? [])
    .filter(
      (item): item is DocumentKnowledgeItemCandidate =>
        item.kind === 'claim' && Boolean(item.metadata?.claim),
    )
    .map((item) => item.metadata!.claim as DocumentKnowledgeClaimPayload);
  const propositions = chunks.flatMap((chunk) => chunk.structuredPropositions ?? []);

  return {
    chunkCount: chunks.length,
    claimCount: claims.length,
    propositionCount: propositions.length,
    commercialPresence: sortedUnique(flatClaimValues(claims, 'commercial_presence')),
    paymentMethods: sortedUnique(flatClaimValues(claims, 'payment_methods')),
    installments: claims
      .filter((claim) => claim.axis === 'payment_terms' && claim.facet === 'installment_count')
      .map((claim) => `${resolveScopedValue(claim, 'payment_method')}:${claim.values.join('|')}`)
      .sort(),
    cards: claims
      .filter((claim) => claim.axis === 'payment_terms' && claim.facet === 'card_brands')
      .map((claim) => `${resolveScopedValue(claim, 'payment_method')}:${claim.values.join('|')}`)
      .sort(),
    pvcColors: claims
      .filter((claim) => claim.axis === 'color_options' && resolveScopedValue(claim, 'material') === 'pvc')
      .flatMap((claim) => claim.values)
      .sort(),
    aluminumColors: claims
      .filter(
        (claim) =>
          claim.axis === 'color_options' &&
          resolveScopedValue(claim, 'material') === 'aluminio' &&
          !claim.values.includes('variety'),
      )
      .flatMap((claim) => claim.values)
      .sort(),
    visitCost: claims
      .filter((claim) => claim.axis === 'commercial_visit_cost')
      .map(
        (claim) =>
          `${resolveScopedValue(claim, 'location')}:${claim.values.join('|')}:${resolveScopedValue(
            claim,
            'location_relation',
          )}`,
      )
      .sort(),
    travelCost: claims
      .filter((claim) => claim.axis === 'travel_cost_responsibility')
      .map(
        (claim) =>
          `${resolveScopedValue(claim, 'location')}:${claim.values.join('|')}:${resolveScopedValue(
            claim,
            'location_relation',
          )}`,
      )
      .sort(),
    warranties: claims
      .filter((claim) => claim.axis === 'warranty_terms')
      .map(
        (claim) =>
          `${(claim.appliesTo ?? [])
            .map((scope) => `${scope.axis}:${scope.normalizedValue ?? scope.value}`)
            .sort()
            .join(',')}:${claim.values.join('|')}`,
      )
      .sort(),
    informativeFlow: sortedUnique(flatClaimValues(claims, 'informative_flow')),
    quoteTransition: sortedUnique(flatClaimValues(claims, 'quote_transition')),
    confirmationPolicy: sortedUnique(flatClaimValues(claims, 'confirmation_policy')),
    organicResponsePattern: sortedUnique(flatClaimValues(claims, 'organic_response_pattern')),
    comparisonGuidance: sortedUnique(flatClaimValues(claims, 'comparison_guidance')),
    supportSerie25: propositions
      .filter(
        (proposition) =>
          proposition.proposition.predicate === 'feature_support' &&
          proposition.proposition.objectNormalizedValue === 'dvh' &&
          proposition.metadata?.claim?.subject?.normalizedValue === 'serie 20 y 25',
      )
      .map((proposition) => proposition.proposition.polarity)
      .sort(),
    supportProbba: propositions
      .filter(
        (proposition) =>
          proposition.proposition.predicate === 'feature_support' &&
          proposition.proposition.objectNormalizedValue === 'dvh' &&
          proposition.metadata?.claim?.subject?.normalizedValue === 'serie probba',
      )
      .map((proposition) => proposition.proposition.polarity)
      .sort(),
  };
}

function flatClaimValues(
  claims: DocumentKnowledgeClaimPayload[],
  axis: string,
) {
  return claims
    .filter((claim) => claim.axis === axis)
    .flatMap((claim) => claim.values);
}

function resolveScopedValue(
  claim: DocumentKnowledgeClaimPayload,
  axis: string,
) {
  return (
    claim.appliesTo?.find((scope) => scope.axis === axis)?.normalizedValue ??
    claim.appliesTo?.find((scope) => scope.axis === axis)?.value ??
    ''
  );
}

function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function resolveComparableKeys(signatures: ExtractedSignature[]) {
  return comparableSignatureKeys.filter((key) =>
    signatures.some((signature) => signature[key].length > 0),
  );
}

function projectComparableSignature(
  signature: ExtractedSignature,
  keys: ComparableSignatureKey[],
) {
  return Object.fromEntries(
    keys.map((key) => [key, signature[key]]),
  ) as Record<ComparableSignatureKey, string[]>;
}
