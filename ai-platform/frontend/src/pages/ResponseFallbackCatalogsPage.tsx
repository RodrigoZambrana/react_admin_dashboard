import {
  listActiveResponseFallbacks,
  listResponseFallbackVersions,
} from '../api';
import { ResourceDomainPage } from './ResourceDomainPage';
import type { ResponseFallbackVersion } from '../types';

export function ResponseFallbackCatalogsPage() {
  return (
    <ResourceDomainPage<ResponseFallbackVersion>
      title="Response fallback catalogs"
      section="Response fallback catalogs"
      description="Inspect deterministic fallback copy as governed locale catalogs rather than inline backend wording."
      emptyTitle="No fallback catalogs found"
      emptyBody="Seed or publish fallback catalogs so deterministic fallback copy remains governed and locale-safe."
      loadVersions={listResponseFallbackVersions}
      loadActive={listActiveResponseFallbacks}
      getId={(version) => version.id}
      getPrimaryLabel={(version) => version.locale}
      getSecondaryLabel={(version) =>
        `${Object.keys(version.resource.templates).length} templates`
      }
      getVersion={(version) => version.version}
      getStatus={(version) => version.status}
      getCreatedAt={(version) => version.createdAt}
      getCreatedBy={(version) => version.createdBy}
      getPayload={(version) => version.resource}
      renderSummary={(version) => (
        <>
          <h6>{version.locale}</h6>
          <p className="text-muted mb-3">
            Catalog version v{version.version} contains deterministic fallback copy,
            action labels, and display defaults.
          </p>
          <div className="react-rich-preview">
            {Object.entries(version.resource.templates)
              .slice(0, 3)
              .map(([key, template]) => `${key}: ${template}`)
              .join('\n')}
          </div>
        </>
      )}
    />
  );
}
