import { FileSystemTemporalLocaleSeedSource } from '../../src/modules/temporal/filesystem-temporal-locale.seed-source';
import { ManagedTemporalLocaleProvider } from '../../src/modules/temporal/managed-temporal-locale.provider';
import { TemporalLocaleResource } from '../../src/modules/temporal/temporal-locale.types';

type TemporalLocaleRecord = {
  id: string;
  locale: string;
  resource: TemporalLocaleResource;
  version: number;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  createdBy: string | null;
};

export function buildManagedTemporalLocaleProviderStub(input?: {
  initialRecords?: TemporalLocaleRecord[];
  seedSource?: {
    listSeeds: () => Promise<
      Array<{
        key: string;
        value: TemporalLocaleResource;
        createdBy?: string;
        metadata?: Record<string, unknown>;
      }>
    >;
  };
}) {
  const records = [...(input?.initialRecords ?? [])];
  const repository = {
    createVersion: jest.fn(
      async (payload: {
        locale: string;
        resource: TemporalLocaleResource;
        createdBy?: string;
        metadata?: Record<string, unknown>;
        activate?: boolean;
      }) => {
        const locale = payload.locale.trim().toLowerCase();
        const version =
          records.filter((record) => record.locale === locale).length + 1;

        if (payload.activate) {
          for (const record of records) {
            if (record.locale === locale && record.status === 'ACTIVE') {
              record.status = 'ARCHIVED';
            }
          }
        }

        const record: TemporalLocaleRecord = {
          id: `seed-${locale}-${version}`,
          locale,
          resource: payload.resource,
          version,
          status: payload.activate ? 'ACTIVE' : 'DRAFT',
          metadata: payload.metadata ?? null,
          createdAt: new Date(),
          createdBy: payload.createdBy ?? null,
        };
        records.push(record);
        return record;
      },
    ),
    hasAnyVersions: jest.fn(async () => records.length > 0),
    listActive: jest.fn(async () =>
      records.filter((record) => record.status === 'ACTIVE'),
    ),
    getActiveByLocale: jest.fn(async (locale: string) => {
      const normalizedLocale = locale.trim().toLowerCase();

      return (
        records.find(
          (record) =>
            record.locale === normalizedLocale && record.status === 'ACTIVE',
        ) ?? null
      );
    }),
  };
  const provider = new ManagedTemporalLocaleProvider(
    repository as any,
    (input?.seedSource ?? new FileSystemTemporalLocaleSeedSource()) as any,
  );

  return {
    provider,
    repository,
    records,
  };
}
