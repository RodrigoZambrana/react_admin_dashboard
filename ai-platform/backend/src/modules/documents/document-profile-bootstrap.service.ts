import { Injectable } from '@nestjs/common';

import { extractKnowledgeAxisSummaries } from './document-knowledge-claims';
import { DocumentChunkCandidate } from './document.types';

@Injectable()
export class DocumentProfileBootstrapService {
  deriveHints(input: {
    chunks: DocumentChunkCandidate[];
    activeProfileIds: string[];
  }) {
    const sections = Array.from(
      new Set(
        input.chunks
          .map((chunk) =>
            typeof chunk.metadata?.section === 'string'
              ? chunk.metadata.section
              : null,
          )
          .filter((value): value is string => Boolean(value)),
      ),
    ).slice(0, 6);
    const axisValues = new Map<string, string[]>();
    const supportCounts = {
      explicit: 0,
      partial: 0,
      boundedInference: 0,
    };

    for (const chunk of input.chunks) {
      for (const claim of extractKnowledgeAxisSummaries(chunk.structuredItems ?? [])) {
        const existing = axisValues.get(claim.axis) ?? [];
        axisValues.set(
          claim.axis,
          Array.from(new Set([...existing, ...claim.values])).slice(0, 8),
        );

        if (claim.supportClass === 'explicit_fact') {
          supportCounts.explicit += 1;
        } else if (claim.supportClass === 'partial_fact') {
          supportCounts.partial += 1;
        } else {
          supportCounts.boundedInference += 1;
        }
      }
    }

    return {
      approvedByUpload: true,
      manualConfigRequired: false,
      activeProfileIds: input.activeProfileIds,
      observedSections: sections,
      observedAxes: Array.from(axisValues.keys()),
      observedValuesByAxis: Object.fromEntries(axisValues),
      supportCounts,
    };
  }
}
