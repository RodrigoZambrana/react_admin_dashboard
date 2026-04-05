import { Injectable } from '@nestjs/common';

import { DocumentExtractionProfileId } from './document-extraction-profile.types';
import { DocumentExtractionProfileDerivedHints } from './document-extraction-profile-config.service';
import { extractKnowledgeAxisSummaries } from './document-knowledge-claims';
import { DocumentChunkCandidate } from './document.types';

@Injectable()
export class DocumentProfileBootstrapService {
  deriveHints(input: {
    chunks: DocumentChunkCandidate[];
    activeProfileIds: DocumentExtractionProfileId[];
  }) {
    const perProfile = new Map<
      DocumentExtractionProfileId,
      {
        observedSections: Set<string>;
        observedAxes: Set<string>;
        observedValuesByAxis: Map<string, Set<string>>;
        supportCounts: {
          explicit: number;
          partial: number;
          boundedInference: number;
        };
      }
    >();

    for (const profileId of input.activeProfileIds) {
      perProfile.set(profileId, createHintAccumulator());
    }

    for (const chunk of input.chunks) {
      const sections =
        typeof chunk.metadata?.section === 'string' && chunk.metadata.section.trim()
          ? [chunk.metadata.section.trim()]
          : [];

      for (const claim of extractKnowledgeAxisSummaries(chunk.structuredItems ?? [])) {
        const profileId = claimProfileIdFromChunk(chunk);

        if (!profileId) {
          continue;
        }

        const accumulator = perProfile.get(profileId) ?? createHintAccumulator();
        sections.forEach((section) => accumulator.observedSections.add(section));
        accumulator.observedAxes.add(claim.axis);
        const existing = accumulator.observedValuesByAxis.get(claim.axis) ?? new Set<string>();
        claim.values.forEach((value) => existing.add(value));
        accumulator.observedValuesByAxis.set(claim.axis, existing);

        if (claim.supportClass === 'explicit_fact') {
          accumulator.supportCounts.explicit += 1;
        } else if (claim.supportClass === 'partial_fact') {
          accumulator.supportCounts.partial += 1;
        } else {
          accumulator.supportCounts.boundedInference += 1;
        }

        perProfile.set(profileId, accumulator);
      }
    }

    return {
      approvedByUpload: true,
      manualConfigRequired: false,
      activeProfileIds: input.activeProfileIds,
      profiles: Array.from(perProfile.entries()).map(([profileId, value]) => ({
        profileId,
        hints: {
          observedSections: Array.from(value.observedSections.values()).slice(0, 6),
          observedAxes: Array.from(value.observedAxes.values()).sort(),
          observedValuesByAxis: Object.fromEntries(
            Array.from(value.observedValuesByAxis.entries()).map(([axis, entries]) => [
              axis,
              Array.from(entries.values()).slice(0, 8),
            ]),
          ),
          supportCounts: value.supportCounts,
        } satisfies DocumentExtractionProfileDerivedHints,
      })),
    };
  }
}

function createHintAccumulator() {
  return {
    observedSections: new Set<string>(),
    observedAxes: new Set<string>(),
    observedValuesByAxis: new Map<string, Set<string>>(),
    supportCounts: {
      explicit: 0,
      partial: 0,
      boundedInference: 0,
    },
  };
}

function claimProfileIdFromChunk(chunk: DocumentChunkCandidate) {
  const profileKeys = new Set<DocumentExtractionProfileId>();

  for (const item of chunk.structuredItems ?? []) {
    if (item.metadata?.profileKey) {
      profileKeys.add(item.metadata.profileKey);
    }
  }

  return profileKeys.size === 1
    ? Array.from(profileKeys.values())[0]
    : undefined;
}
