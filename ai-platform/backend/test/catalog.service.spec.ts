import { createServer } from 'node:http';

import {
  CatalogSourceKind,
  CatalogSyncStatus,
  ManagedResourceStatus,
} from '@prisma/client';

import { CatalogRestSourceAdapter } from '../src/modules/catalog/catalog-rest-source.adapter';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { CatalogStructuredSourceService } from '../src/modules/catalog/catalog-structured-source.service';
import { StructuredCatalogUploadAdapter } from '../src/modules/tenant-resources/structured-catalog-upload.adapter';

describe('CatalogService', () => {
  it('loads an uploaded structured catalog source and keeps product lookup honest on no-match', async () => {
    const service = createCatalogService();

    await service.createUploadedSource({
      title: 'Lighting Catalog',
      activate: true,
      file: {
        originalName: 'lighting.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          [
            'sku,name,price,currency,availability',
            'B-77,Beacon Desk Lamp,89,USD,backorder',
          ].join('\n'),
          'utf8',
        ),
      },
    });

    await expect(
      service.findMatch({ query: 'Beacon Desk Lamp' }),
    ).resolves.toEqual(
      expect.objectContaining({
        matched: true,
        matchedBy: 'query',
        product: expect.objectContaining({
          sku: 'B-77',
          name: 'Beacon Desk Lamp',
          sourceKind: 'UPLOADED_STRUCTURED',
        }),
      }),
    );

    await expect(
      service.findMatch({ query: 'Unknown Lamp' }),
    ).resolves.toEqual({
      matched: false,
      matchedBy: null,
      product: null,
      score: 0,
    });
  });

  it('hydrates a REST-backed catalog source and resolves lookups through the same boundary', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          items: [
            {
              sku: 'A-19',
              name: 'Atlas Carry Case',
              price: 129,
              currency: 'USD',
              availability: 'in_stock',
            },
          ],
        }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port =
      address && typeof address === 'object' ? address.port : 0;

    try {
      const service = createCatalogService();
      await service.createRestSource({
        title: 'Remote Catalog',
        endpointUrl: `http://127.0.0.1:${port}/products`,
        activate: true,
        headers: {},
        fieldMap: {},
      });

      await expect(
        service.findMatch({ sku: 'A-19' }),
      ).resolves.toEqual(
        expect.objectContaining({
          matched: true,
          matchedBy: 'sku',
          product: expect.objectContaining({
            sku: 'A-19',
            name: 'Atlas Carry Case',
            sourceKind: 'REST',
          }),
        }),
      );
    } finally {
      server.close();
    }
  });
});

function createCatalogService() {
  const sourceRecords: Array<any> = [];
  const itemRecords: Array<any> = [];

  const catalogSourceRepository = {
    create: jest.fn(async (input: any) => {
      const record = {
        id: `source_${sourceRecords.length + 1}`,
        tenantId: 'tenant-alpha',
        title: input.title,
        kind: input.kind,
        status: input.status ?? ManagedResourceStatus.DRAFT,
        syncStatus: input.syncStatus ?? CatalogSyncStatus.PENDING,
        sourceName: input.sourceName ?? null,
        mimeType: input.mimeType ?? null,
        endpointUrl: input.endpointUrl ?? null,
        sourceConfig: input.sourceConfig ?? null,
        metadata: input.metadata ?? null,
        itemCount: 0,
        lastSyncedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };
      sourceRecords.push(record);
      return record;
    }),
    list: jest.fn(async () => sourceRecords),
    findById: jest.fn(async (sourceId: string) => {
      const source = sourceRecords.find((record) => record.id === sourceId);

      if (!source) {
        return null;
      }

      return {
        ...source,
        items: itemRecords.filter((item) => item.sourceId === sourceId),
      };
    }),
    markSyncing: jest.fn(async (sourceId: string) => {
      const source = sourceRecords.find((record) => record.id === sourceId);
      source.syncStatus = CatalogSyncStatus.SYNCING;
      source.lastError = null;
      return { ...source, items: itemRecords.filter((item) => item.sourceId === sourceId) };
    }),
    markReady: jest.fn(async (input: any) => {
      const source = sourceRecords.find((record) => record.id === input.sourceId);
      source.syncStatus = CatalogSyncStatus.READY;
      source.status = input.status;
      source.itemCount = input.itemCount;
      source.metadata = input.metadata ?? source.metadata;
      source.lastSyncedAt = new Date();
      source.updatedAt = new Date();
      return { ...source, items: itemRecords.filter((item) => item.sourceId === input.sourceId) };
    }),
    markFailed: jest.fn(async (sourceId: string, errorMessage: string) => {
      const source = sourceRecords.find((record) => record.id === sourceId);
      source.syncStatus = CatalogSyncStatus.FAILED;
      source.lastError = errorMessage;
      return { ...source, items: itemRecords.filter((item) => item.sourceId === sourceId) };
    }),
    activate: jest.fn(async (sourceId: string) => {
      const source = sourceRecords.find((record) => record.id === sourceId);
      source.status = ManagedResourceStatus.ACTIVE;
      return { ...source, items: itemRecords.filter((item) => item.sourceId === sourceId) };
    }),
    archive: jest.fn(async (sourceId: string) => {
      const source = sourceRecords.find((record) => record.id === sourceId);
      source.status = ManagedResourceStatus.ARCHIVED;
      return { ...source, items: itemRecords.filter((item) => item.sourceId === sourceId) };
    }),
  };

  const catalogItemRepository = {
    replaceForSource: jest.fn(async (input: any) => {
      for (let index = itemRecords.length - 1; index >= 0; index -= 1) {
        if (itemRecords[index].sourceId === input.sourceId) {
          itemRecords.splice(index, 1);
        }
      }

      input.items.forEach((item: any, index: number) => {
        itemRecords.push({
          id: `${input.sourceId}_item_${index + 1}`,
          tenantId: 'tenant-alpha',
          sourceId: input.sourceId,
          ...item,
          source: sourceRecords.find((record) => record.id === input.sourceId),
        });
      });

      return itemRecords.filter((item) => item.sourceId === input.sourceId);
    }),
    listByActiveSources: jest.fn(async () =>
      itemRecords.filter(
        (item) =>
          item.source.status === ManagedResourceStatus.ACTIVE &&
          item.source.syncStatus === CatalogSyncStatus.READY,
      ),
    ),
  };

  return new CatalogService(
    catalogSourceRepository as any,
    catalogItemRepository as any,
    new CatalogStructuredSourceService(new StructuredCatalogUploadAdapter()),
    new CatalogRestSourceAdapter(),
    {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as any,
  );
}
