import { KnowledgeCategory } from '@prisma/client';

type KnowledgeCandidate = {
  category: KnowledgeCategory;
  title: string;
  body: string;
  summary: string;
  tags: string[];
  confidence: number;
  metadata?: Record<string, unknown>;
};

type ExtractionInput = {
  stage: string;
  payload: Record<string, unknown>;
};

function categoryFromTool(toolName?: string) {
  if (toolName === 'create_booking') {
    return KnowledgeCategory.BOOKING;
  }

  if (toolName === 'create_quote') {
    return KnowledgeCategory.QUOTE;
  }

  if (toolName === 'get_product') {
    return KnowledgeCategory.PRODUCT;
  }

  return KnowledgeCategory.GENERAL;
}

export function extractKnowledgeCandidate(
  input: ExtractionInput,
): KnowledgeCandidate | null {
  if (input.stage === 'execution') {
    const toolName =
      typeof input.payload.toolName === 'string' ? input.payload.toolName : undefined;
    const output =
      typeof input.payload.output === 'object' &&
      input.payload.output !== null &&
      !Array.isArray(input.payload.output)
        ? input.payload.output
        : {};

    return {
      category: categoryFromTool(toolName),
      title: `${toolName ?? 'tool'} execution outcome`,
      body: `Validated tool execution completed with payload ${JSON.stringify(output)}.`,
      summary: `${toolName ?? 'tool'} produced an approved backend result.`,
      tags: [toolName ?? 'tool', 'execution'],
      confidence: 0.76,
      metadata: {
        toolName,
      },
    };
  }

  if (input.stage === 'response') {
    const response =
      typeof input.payload.message === 'string'
        ? input.payload.message
        : typeof input.payload.response === 'string'
          ? input.payload.response
          : null;

    if (!response) {
      return null;
    }

    return {
      category: KnowledgeCategory.GENERAL,
      title: 'Approved response pattern',
      body: `Approved assistant response pattern: ${response.slice(0, 180)}`,
      summary: 'A backend-approved response was generated.',
      tags: ['response', 'approved'],
      confidence: 0.61,
    };
  }

  return null;
}
