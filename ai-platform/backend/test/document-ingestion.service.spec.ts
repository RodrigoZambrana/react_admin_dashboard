import { DocumentIngestionService } from '../src/modules/documents/document-ingestion.service';

describe('DocumentIngestionService', () => {
  it('activates the product/catalog extraction profile through tenant capability context', async () => {
    const documentRepository = {
      markProcessing: jest.fn(async () => ({
        id: 'doc-1',
        sourceText:
          'CORTINAS DE ENROLLAR\n\nDisponibles en PVC y aluminio. Tipos: Roller Screen y Roller Blackout.',
        originKind: 'TEXT',
        language: 'es',
        metadata: { sourceName: 'catalogo.txt' },
      })),
      markReady: jest.fn(async (input) => ({
        id: input.documentId,
        status: input.status,
        ingestionStatus: 'READY',
      })),
      markFailed: jest.fn(async () => null),
    };
    const documentChunkRepository = {
      replaceForDocument: jest.fn(async () => []),
    };
    const extractionService = {
      buildChunkCandidates: jest.fn(() => [
        {
          sequence: 0,
          content: 'Disponibles en PVC y aluminio.',
          searchText: 'disponibles en pvc y aluminio',
          retrievalProjection: 'cortinas enrollar materials pvc aluminio',
          metadata: null,
          structuredItems: [],
        },
      ]),
    };
    const tenantCapabilityRegistry = {
      resolveForCurrentTenant: jest.fn(async () => ({
        tenantId: 'tenant-alpha',
        enabledKeys: ['product_catalog_lookup'],
        capabilities: {
          booking: { enabled: true },
          quote: { enabled: true },
          product_catalog_lookup: { enabled: true },
          support_post_sale: { enabled: true },
        },
      })),
    };
    const service = new DocumentIngestionService(
      documentRepository as any,
      documentChunkRepository as any,
      extractionService as any,
      {
        log: jest.fn(),
        error: jest.fn(),
      } as any,
      tenantCapabilityRegistry as any,
    );

    await service.ingestDocument({
      documentId: 'doc-1',
      activate: true,
      createdBy: 'test',
    });

    expect(extractionService.buildChunkCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        extractionContext: expect.objectContaining({
          tenantId: 'tenant-alpha',
          activeCapabilities: ['product_catalog_lookup'],
        }),
        sourceMetadata: expect.objectContaining({
          sourceName: 'catalogo.txt',
        }),
      }),
    );
  });
});
