export type DocumentChunkUsageBoundary = 'knowledge' | 'operational';

type DocumentChunkBoundaryMetadata = {
  usageBoundary?: DocumentChunkUsageBoundary;
  heading?: string;
};

const operationalSectionSignals = [
  'datos utiles para presupuesto',
  'datos útiles para presupuesto',
  'limites de respuesta',
  'límites de respuesta',
  'cuando la consulta es informativa',
  'cuando la consulta pasa a presupuesto',
  'regla practica',
  'regla práctica',
];

export function buildDocumentChunkBoundaryMetadata(
  content: string,
): DocumentChunkBoundaryMetadata {
  const heading = extractDocumentChunkHeading(content);
  const usageBoundary = classifyDocumentChunkUsageBoundary({
    content,
    metadata: {
      heading,
    },
  });

  return {
    usageBoundary,
    heading,
  };
}

export function classifyDocumentChunkUsageBoundary(input: {
  content: string;
  metadata?: Record<string, unknown> | null;
}): DocumentChunkUsageBoundary {
  if (input.metadata?.usageBoundary === 'knowledge') {
    return 'knowledge';
  }

  if (input.metadata?.usageBoundary === 'operational') {
    return 'operational';
  }

  const normalizedCandidates = [
    typeof input.metadata?.heading === 'string' ? input.metadata.heading : '',
    extractDocumentChunkBoundaryLead(input.content),
  ]
    .map(normalizeDocumentChunkBoundaryText)
    .filter((value) => value.length > 0);

  if (
    normalizedCandidates.some((value) =>
      operationalSectionSignals.some((signal) =>
        value.includes(normalizeDocumentChunkBoundaryText(signal)),
      ),
    )
  ) {
    return 'operational';
  }

  return 'knowledge';
}

export function extractDocumentChunkHeading(content: string) {
  const firstLine = content
    .split(/\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return undefined;
  }

  const headingMatch = firstLine.match(/^([^:]{1,72}):/u);

  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  return undefined;
}

function normalizeDocumentChunkBoundaryText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function extractDocumentChunkBoundaryLead(content: string) {
  const leadLine = content
    .split(/\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(0);

  return (leadLine ?? '').slice(0, 180);
}
