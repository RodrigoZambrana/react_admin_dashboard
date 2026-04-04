import {
  listActiveKnowledgeMetadata,
  listKnowledgeMetadataVersions,
} from '../api';
import { ResourceDomainPage } from './ResourceDomainPage';
import type { KnowledgeMetadataVersion } from '../types';

export function KnowledgeMetadataPage() {
  return (
    <ResourceDomainPage<KnowledgeMetadataVersion>
      title="Knowledge metadata"
      section="Knowledge metadata"
      description="Review governed metadata policies that shape learning extraction and future knowledge operations."
      emptyTitle="No knowledge metadata found"
      emptyBody="Publish metadata policies to control learning behavior over persisted traces."
      loadVersions={listKnowledgeMetadataVersions}
      loadActive={listActiveKnowledgeMetadata}
      getId={(version) => version.id}
      getPrimaryLabel={(version) => version.key}
      getSecondaryLabel={(version) =>
        `${version.resource.enabledStages.length} enabled stages`
      }
      getVersion={(version) => version.version}
      getStatus={(version) => version.status}
      getCreatedAt={(version) => version.createdAt}
      getCreatedBy={(version) => version.createdBy}
      getPayload={(version) => version.resource}
      renderSummary={(version) => (
        <>
          <h6>{version.key}</h6>
          <p className="text-muted mb-3">
            Metadata policy v{version.version} constrains governed learning and
            later knowledge-center tooling.
          </p>
          <div className="react-chip-list">
            {version.resource.enabledStages.map((stage) => (
              <span key={stage} className="badge badge-soft-dark">
                {stage}
              </span>
            ))}
          </div>
        </>
      )}
    />
  );
}
