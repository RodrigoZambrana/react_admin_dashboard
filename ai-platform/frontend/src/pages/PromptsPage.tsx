import { listActivePrompts, listPromptVersions } from '../api';
import { ResourceDomainPage } from './ResourceDomainPage';
import type { PromptVersion } from '../types';

export function PromptsPage() {
  return (
    <ResourceDomainPage<PromptVersion>
      title="Prompt operations"
      section="Prompts"
      description="Inspect governed prompt versions before Wave 6 ABM editing is layered on top of the runtime-managed backend contracts."
      emptyTitle="No prompt versions found"
      emptyBody="Seeded prompt resources should appear here once the backend tenant has active prompt versions."
      loadVersions={listPromptVersions}
      loadActive={listActivePrompts}
      getId={(version) => version.id}
      getPrimaryLabel={(version) => version.key}
      getSecondaryLabel={(version) => `${version.template.slice(0, 72)}...`}
      getVersion={(version) => version.version}
      getStatus={(version) => version.status}
      getCreatedAt={(version) => version.createdAt}
      getCreatedBy={(version) => version.createdBy}
      getPayload={(version) => ({
        key: version.key,
        template: version.template,
        metadata: version.metadata ?? null,
      })}
      renderSummary={(version) => (
        <>
          <h6>{version.key}</h6>
          <p className="text-muted mb-3">
            Prompt version v{version.version} controls {version.key} wording in the
            live AI path.
          </p>
          <div className="react-rich-preview">{version.template}</div>
        </>
      )}
    />
  );
}
