import { ManagedResourceStatus } from '@prisma/client';

import { asKnowledgeMetadata } from './document-knowledge-claims';
import {
  DocumentCorpusRole,
  DocumentKnowledgeLayer,
} from './document.types';

type CorpusDocumentLike = {
  id: string;
  title: string;
  status?: ManagedResourceStatus | string;
  ingestionStatus?: string;
  language?: string | null;
  sourceName?: string | null;
  originKind?: string;
  metadata?: unknown;
  updatedAt?: Date | string;
};

type CorpusChunkLike = {
  documentId: string;
  sequence: number;
  metadata?: unknown;
  knowledgeItems?: Array<{
    kind: string;
    metadata?: unknown;
  }>;
  document: CorpusDocumentLike;
};

type DocumentCorpusClassification = {
  role: DocumentCorpusRole;
  layers: DocumentKnowledgeLayer[];
  counts: Record<DocumentKnowledgeLayer, number>;
};

type ActiveCorpusComposition<TChunk extends CorpusChunkLike> = {
  chunks: TChunk[];
  documents: Array<
    CorpusDocumentLike & {
      corpusRole: DocumentCorpusRole;
      corpusLayers: DocumentKnowledgeLayer[];
    }
  >;
  authoritativeDocumentsByLayer: Partial<
    Record<
      DocumentKnowledgeLayer,
      CorpusDocumentLike & {
        corpusRole: DocumentCorpusRole;
        corpusLayers: DocumentKnowledgeLayer[];
      }
    >
  >;
};

const allKnowledgeLayers: DocumentKnowledgeLayer[] = [
  'factual',
  'prudence',
  'workflow',
  'guidance',
];

const validCorpusRoles = new Set<DocumentCorpusRole>([
  'mixed_master',
  'factual_master',
  'operational_guide',
  'prudence_policy',
]);

export function buildDocumentCorpusMetadata<TChunk extends CorpusChunkLike>(
  chunks: TChunk[],
) {
  const classification = classifyDocumentCorpus(chunks);

  return {
    documentRole: classification.role,
    documentLayers: classification.layers,
    documentLayerCounts: classification.counts,
    documentClassificationVersion: 1,
  };
}

export function composeActiveCorpusByLayer<TChunk extends CorpusChunkLike>(
  chunks: TChunk[],
): ActiveCorpusComposition<TChunk> {
  const documentsById = new Map<
    string,
    {
      document: CorpusDocumentLike;
      chunks: TChunk[];
      classification: DocumentCorpusClassification;
    }
  >();

  for (const chunk of chunks) {
    const documentId = resolveChunkDocumentId(chunk);
    const existing = documentsById.get(documentId) ?? {
      document: chunk.document,
      chunks: [],
      classification: classifyDocumentCorpus([]),
    };
    existing.chunks.push(chunk);
    documentsById.set(documentId, existing);
  }

  for (const entry of documentsById.values()) {
    const derived = classifyDocumentCorpus(entry.chunks);
    entry.classification = {
      role: resolveDocumentCorpusRole({
        document: entry.document,
        chunks: entry.chunks,
      }),
      layers: resolveDocumentCorpusLayers({
        document: entry.document,
        chunks: entry.chunks,
      }),
      counts: derived.counts,
    };
  }

  const authoritativeDocumentsByLayer: ActiveCorpusComposition<TChunk>['authoritativeDocumentsByLayer'] =
    {};

  for (const layer of allKnowledgeLayers) {
    const selected = [...documentsById.values()]
      .filter((entry) => supportsDocumentLayer(entry.classification, layer))
      .sort((left, right) => compareDocumentsForLayer(left, right, layer))[0];

    if (!selected) {
      continue;
    }

    authoritativeDocumentsByLayer[layer] = {
      ...selected.document,
      corpusRole: selected.classification.role,
      corpusLayers: selected.classification.layers,
    };
  }

  const selectedChunks = chunks.filter((chunk) => {
    const primaryLayer = resolveChunkPrimaryLayer(chunk);
    const authoritativeDocument = authoritativeDocumentsByLayer[primaryLayer];
    const documentId = resolveChunkDocumentId(chunk);

    if (!authoritativeDocument) {
      return true;
    }

    return authoritativeDocument.id === documentId;
  });

  const selectedDocuments = dedupeDocuments(
    selectedChunks.map((chunk) => ({
      ...chunk.document,
      corpusRole:
        documentsById.get(resolveChunkDocumentId(chunk))?.classification.role ??
        'factual_master',
      corpusLayers:
        documentsById.get(resolveChunkDocumentId(chunk))?.classification.layers ?? [
          'factual',
        ],
    })),
  );

  return {
    chunks: selectedChunks,
    documents: selectedDocuments,
    authoritativeDocumentsByLayer,
  };
}

export function resolveDocumentCorpusRole(input: {
  document: Pick<CorpusDocumentLike, 'metadata'>;
  chunks?: CorpusChunkLike[];
}) {
  const metadataRole = readMetadataCorpusRole(input.document.metadata);

  if (metadataRole) {
    return metadataRole;
  }

  return classifyDocumentCorpus(input.chunks ?? []).role;
}

export function resolveDocumentCorpusLayers(input: {
  document: Pick<CorpusDocumentLike, 'metadata'>;
  chunks?: CorpusChunkLike[];
}) {
  const metadataLayers = readMetadataCorpusLayers(input.document.metadata);

  if (metadataLayers.length > 0) {
    return metadataLayers;
  }

  return classifyDocumentCorpus(input.chunks ?? []).layers;
}

function classifyDocumentCorpus<TChunk extends CorpusChunkLike>(
  chunks: TChunk[],
): DocumentCorpusClassification {
  const counts: Record<DocumentKnowledgeLayer, number> = {
    factual: 0,
    prudence: 0,
    workflow: 0,
    guidance: 0,
  };

  for (const chunk of chunks) {
    const primaryLayer = resolveChunkPrimaryLayer(chunk);
    counts[primaryLayer] += 1;
  }

  const layers = allKnowledgeLayers.filter((layer) => counts[layer] > 0);
  const factual = counts.factual;
  const prudence = counts.prudence;
  const workflow = counts.workflow;
  const guidance = counts.guidance;
  const behavioral = prudence + workflow + guidance;

  if (factual >= 6 && behavioral >= 4) {
    return {
      role: 'mixed_master',
      layers: layers.length > 0 ? layers : ['factual'],
      counts,
    };
  }

  if (prudence >= Math.max(workflow, guidance) && prudence >= 2 && factual <= 2) {
    return {
      role: 'prudence_policy',
      layers: layers.length > 0 ? layers : ['prudence'],
      counts,
    };
  }

  if (behavioral >= factual && behavioral > 0) {
    return {
      role: 'operational_guide',
      layers: layers.length > 0 ? layers : ['workflow'],
      counts,
    };
  }

  return {
    role: 'factual_master',
    layers: layers.length > 0 ? layers : ['factual'],
    counts,
  };
}

function resolveChunkPrimaryLayer(chunk: CorpusChunkLike): DocumentKnowledgeLayer {
  const counts: Record<DocumentKnowledgeLayer, number> = {
    factual: 0,
    prudence: 0,
    workflow: 0,
    guidance: 0,
  };

  for (const item of chunk.knowledgeItems ?? []) {
    if (item.kind !== 'CLAIM' && item.kind !== 'claim') {
      continue;
    }

    const metadata = asKnowledgeMetadata(item.metadata);
    const layer = metadata?.claim?.layer ?? 'factual';
    counts[layer] += 1;
  }

  const usageBoundary = readUsageBoundary(chunk.metadata);
  const preferredTieOrder =
    usageBoundary === 'operational'
      ? ['workflow', 'guidance', 'prudence', 'factual']
      : allKnowledgeLayers;

  const ranked = allKnowledgeLayers
    .map((layer) => ({ layer, count: counts[layer] }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return (
        preferredTieOrder.indexOf(left.layer) - preferredTieOrder.indexOf(right.layer)
      );
    });

  if (ranked[0]?.count && ranked[0].count > 0) {
    return ranked[0].layer;
  }

  if (usageBoundary === 'operational') {
    return 'workflow';
  }

  return 'factual';
}

function supportsDocumentLayer(
  classification: DocumentCorpusClassification,
  layer: DocumentKnowledgeLayer,
) {
  if (classification.layers.includes(layer)) {
    return true;
  }

  if (layer === 'factual') {
    return (
      classification.role === 'mixed_master' ||
      classification.role === 'factual_master'
    );
  }

  if (layer === 'prudence') {
    return (
      classification.role === 'mixed_master' ||
      classification.role === 'prudence_policy' ||
      classification.role === 'operational_guide'
    );
  }

  return (
    classification.role === 'mixed_master' ||
    classification.role === 'operational_guide'
  );
}

function compareDocumentsForLayer(
  left: {
    document: CorpusDocumentLike;
    classification: DocumentCorpusClassification;
  },
  right: {
    document: CorpusDocumentLike;
    classification: DocumentCorpusClassification;
  },
  layer: DocumentKnowledgeLayer,
) {
  const leftPriority = roleLayerPriority(left.classification.role, layer);
  const rightPriority = roleLayerPriority(right.classification.role, layer);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return toTimestamp(right.document.updatedAt) - toTimestamp(left.document.updatedAt);
}

function roleLayerPriority(
  role: DocumentCorpusRole,
  layer: DocumentKnowledgeLayer,
) {
  const priorities: Record<
    DocumentKnowledgeLayer,
    Record<DocumentCorpusRole, number>
  > = {
    factual: {
      mixed_master: 0,
      factual_master: 1,
      operational_guide: 2,
      prudence_policy: 3,
    },
    prudence: {
      mixed_master: 0,
      prudence_policy: 1,
      operational_guide: 2,
      factual_master: 3,
    },
    workflow: {
      mixed_master: 0,
      operational_guide: 1,
      factual_master: 2,
      prudence_policy: 3,
    },
    guidance: {
      mixed_master: 0,
      operational_guide: 1,
      factual_master: 2,
      prudence_policy: 3,
    },
  };

  return priorities[layer][role];
}

function dedupeDocuments<
  TDocument extends CorpusDocumentLike & {
    corpusRole: DocumentCorpusRole;
    corpusLayers: DocumentKnowledgeLayer[];
  },
>(documents: TDocument[]) {
  const byId = new Map<string, TDocument>();

  for (const document of documents) {
    if (!byId.has(document.id)) {
      byId.set(document.id, document);
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt),
  );
}

function toTimestamp(value: Date | string | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function readMetadataCorpusRole(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const role = (value as Record<string, unknown>).documentRole;

  if (typeof role !== 'string' || !validCorpusRoles.has(role as DocumentCorpusRole)) {
    return null;
  }

  return role as DocumentCorpusRole;
}

function readMetadataCorpusLayers(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const layers = (value as Record<string, unknown>).documentLayers;

  if (!Array.isArray(layers)) {
    return [];
  }

  return layers.filter(
    (layer): layer is DocumentKnowledgeLayer =>
      typeof layer === 'string' && allKnowledgeLayers.includes(layer as DocumentKnowledgeLayer),
  );
}

function readUsageBoundary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const usageBoundary = (value as Record<string, unknown>).usageBoundary;
  return usageBoundary === 'operational' || usageBoundary === 'knowledge'
    ? usageBoundary
    : null;
}

function resolveChunkDocumentId(chunk: CorpusChunkLike) {
  if (typeof chunk.documentId === 'string' && chunk.documentId.trim().length > 0) {
    return chunk.documentId;
  }

  return chunk.document.id;
}
