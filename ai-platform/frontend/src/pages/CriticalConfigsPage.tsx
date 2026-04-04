import { listActiveCriticalConfigs, listCriticalConfigVersions } from '../api';
import { ResourceDomainPage } from './ResourceDomainPage';
import type { CriticalConfigVersion } from '../types';

export function CriticalConfigsPage() {
  return (
    <ResourceDomainPage<CriticalConfigVersion>
      title="Critical config operations"
      section="Critical configs"
      description="Review governed runtime config versions for providers and learning policies before editing flows are enabled."
      emptyTitle="No critical configs found"
      emptyBody="Publish governed runtime configs to make them available for provider and learning services."
      loadVersions={listCriticalConfigVersions}
      loadActive={listActiveCriticalConfigs}
      getId={(version) => version.id}
      getPrimaryLabel={(version) => version.key}
      getSecondaryLabel={(version) =>
        version.key === 'ai_runtime'
          ? `provider ${(version.value as any).provider ?? 'n/a'}`
          : `${(version.value as any).observedStages?.length ?? 0} observed stages`
      }
      getVersion={(version) => version.version}
      getStatus={(version) => version.status}
      getCreatedAt={(version) => version.createdAt}
      getCreatedBy={(version) => version.createdBy}
      getPayload={(version) => version.value}
      renderSummary={(version) => (
        <>
          <h6>{version.key}</h6>
          <p className="text-muted mb-3">
            Config version v{version.version} is governed through the same
            lifecycle used by prompts and locale resources.
          </p>
          <div className="react-rich-preview">
            {version.key === 'ai_runtime'
              ? `Provider ${(version.value as any).provider}, model ${(version.value as any).model}, timeout ${(version.value as any).timeoutMs}ms`
              : `Learning enabled ${(version.value as any).enabled ? 'yes' : 'no'} across ${(version.value as any).observedStages?.join(', ')}`}
          </div>
        </>
      )}
    />
  );
}
