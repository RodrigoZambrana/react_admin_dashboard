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
      buildChunkCandidates: jest
        .fn()
        .mockImplementationOnce(() => [
          {
            sequence: 0,
            content: 'Disponibles en PVC y aluminio.',
            searchText: 'disponibles en pvc y aluminio',
            retrievalProjection: 'cortinas enrollar materials pvc aluminio',
            metadata: {
              section: 'CORTINAS DE ENROLLAR',
            },
            structuredItems: [],
          },
        ])
        .mockImplementationOnce(() => [
          {
            sequence: 0,
            content: 'Disponibles en PVC y aluminio.',
            searchText: 'disponibles en pvc y aluminio',
            retrievalProjection: 'cortinas enrollar materials pvc aluminio',
            metadata: {
              section: 'CORTINAS DE ENROLLAR',
            },
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
    const profileResolver = {
      resolveProfileIds: jest.fn(() => ['product_catalog']),
    };
    const configService = {
      resolveEffectiveConfigs: jest.fn(async () => ({
        product_catalog: {
          derivedHints: {
            observedAxes: ['materials'],
          },
        },
      })),
      persistTenantDerivedHints: jest.fn(async () => null),
    };
    const bootstrapService = {
      deriveHints: jest
        .fn()
        .mockImplementation(() => ({
          approvedByUpload: true,
          manualConfigRequired: false,
          activeProfileIds: ['product_catalog'],
          profiles: [
            {
              profileId: 'product_catalog',
              hints: {
                observedSections: ['CORTINAS DE ENROLLAR'],
                observedAxes: ['materials'],
                observedValuesByAxis: {
                  materials: ['PVC', 'aluminio'],
                },
                sectionAliasesByAxis: {
                  materials: ['CORTINAS DE ENROLLAR'],
                },
                supportCounts: {
                  explicit: 1,
                  partial: 0,
                  boundedInference: 0,
                },
              },
            },
          ],
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
      profileResolver as any,
      configService as any,
      bootstrapService as any,
    );

    await service.ingestDocument({
      documentId: 'doc-1',
      activate: true,
      createdBy: 'test',
    });

    expect(extractionService.buildChunkCandidates).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        extractionContext: expect.objectContaining({
          tenantId: 'tenant-alpha',
          activeCapabilities: ['product_catalog_lookup'],
          profileConfigHints: {
            product_catalog: {
              observedAxes: ['materials'],
            },
          },
        }),
        sourceMetadata: expect.objectContaining({
          sourceName: 'catalogo.txt',
        }),
      }),
    );
    expect(extractionService.buildChunkCandidates).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        extractionContext: expect.objectContaining({
          profileConfigHints: {
            product_catalog: {
              observedAxes: ['materials'],
              observedSections: ['CORTINAS DE ENROLLAR'],
              observedValuesByAxis: {
                materials: ['PVC', 'aluminio'],
              },
              sectionAliasesByAxis: {
                materials: ['CORTINAS DE ENROLLAR'],
              },
              supportCounts: {
                explicit: 1,
                partial: 0,
                boundedInference: 0,
              },
            },
          },
        }),
      }),
    );
    expect(profileResolver.resolveProfileIds).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-alpha',
        activeCapabilities: ['product_catalog_lookup'],
      }),
    );
    expect(configService.resolveEffectiveConfigs).toHaveBeenCalledWith({
      profileIds: ['product_catalog'],
      locale: 'es',
    });
    expect(bootstrapService.deriveHints).toHaveBeenCalledTimes(2);
    expect(bootstrapService.deriveHints).toHaveBeenNthCalledWith(1, {
      chunks: expect.any(Array),
      activeProfileIds: ['product_catalog'],
    });
    expect(bootstrapService.deriveHints).toHaveBeenNthCalledWith(2, {
      chunks: expect.any(Array),
      activeProfileIds: ['product_catalog'],
    });
    expect(configService.persistTenantDerivedHints).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        locale: 'es',
        profiles: [
          expect.objectContaining({
            profileId: 'product_catalog',
          }),
        ],
      }),
    );
    expect(documentRepository.markReady).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          approvalMode: 'uploaded_document',
          extractionBootstrap: expect.objectContaining({
            approvedByUpload: true,
          }),
        }),
      }),
    );
  });
});
