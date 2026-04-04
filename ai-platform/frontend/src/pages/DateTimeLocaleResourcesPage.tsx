import {
  listActiveDateTimeLocales,
  listDateTimeLocaleVersions,
} from '../api';
import { ResourceDomainPage } from './ResourceDomainPage';
import type { TemporalLocaleVersion } from '../types';

export function DateTimeLocaleResourcesPage() {
  return (
    <ResourceDomainPage<TemporalLocaleVersion>
      title="Date-time locale resources"
      section="Date-time locale resources"
      description="Operate multilingual backend-owned date/time lexical catalogs without leaking filesystem or parser assumptions into the UI."
      emptyTitle="No date-time locale resources found"
      emptyBody="Seed or publish locale resources to make them available to the parsing subsystem."
      loadVersions={listDateTimeLocaleVersions}
      loadActive={listActiveDateTimeLocales}
      getId={(version) => version.id}
      getPrimaryLabel={(version) => version.locale}
      getSecondaryLabel={(version) =>
        `${version.resource.datePhrases.length} phrases · ${version.resource.timeJoiners.length} joiners`
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
            Locale catalog v{version.version} drives backend normalization for
            human-language date and time expressions.
          </p>
          <div className="react-chip-list">
            {version.resource.datePhrases.map((phrase) => (
              <span key={phrase} className="badge badge-soft-info">
                {phrase}
              </span>
            ))}
          </div>
        </>
      )}
    />
  );
}
