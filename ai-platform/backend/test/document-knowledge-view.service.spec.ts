import { DocumentKnowledgeViewService } from '../src/modules/documents/document-knowledge-view.service';

describe('DocumentKnowledgeViewService', () => {
  it('builds a grounded active knowledge view from extracted claims and provenance', async () => {
    const service = new DocumentKnowledgeViewService(
      {
        findById: jest.fn(),
      } as any,
      {
        listActiveReadyChunks: jest.fn(async () => [
          {
            sequence: 0,
            metadata: {
              section: 'CORTINAS DE ENROLLAR',
              supportSummary: {
                topic: 'CORTINAS DE ENROLLAR',
                supportedAxes: ['materials'],
                unspecifiedAxes: ['exact_color_options'],
              },
            },
            document: {
              id: 'doc-1',
              title: 'Catalogo',
              status: 'ACTIVE',
              ingestionStatus: 'READY',
              language: 'es',
              sourceName: 'catalogo.txt',
              originKind: 'TEXT',
              updatedAt: new Date('2026-04-05T01:00:00.000Z'),
            },
            knowledgeItems: [
              {
                kind: 'CLAIM',
                label: 'materials',
                valueText: 'PVC | aluminio',
                normalizedValue: 'pvc aluminio',
                supportClass: 'EXPLICIT_FACT',
                evidenceTextSpan: 'Disponibles en PVC y aluminio.',
                metadata: {
                  extractionScope: 'tenant_only',
                  profileKey: 'product_catalog',
                  claim: {
                    axis: 'materials',
                    kind: 'value_list',
                    values: ['PVC', 'aluminio'],
                  },
                },
              },
              {
                kind: 'ENTITY',
                label: 'material',
                valueText: 'PVC',
                normalizedValue: 'pvc',
                supportClass: 'EXPLICIT_FACT',
                evidenceTextSpan: 'Disponibles en PVC y aluminio.',
                metadata: {
                  extractionScope: 'tenant_only',
                  profileKey: 'product_catalog',
                },
              },
            ],
          },
        ]),
      } as any,
      {
        resolveEffectiveConfigs: jest.fn(async () => ({
          product_catalog: {
            profileId: 'product_catalog',
            locale: 'es',
            derivedHints: {
              observedAxes: ['materials'],
            },
            resolution: {
              tenantDerivedApplied: true,
              derivedFromDocuments: [
                {
                  documentId: 'doc-1',
                  title: 'Catalogo',
                  updatedAt: '2026-04-05T01:00:00.000Z',
                },
              ],
              sources: {
                axes: {
                  materials: 'mixed',
                },
                matchingHints: {
                  listStopTerms: 'platform_default',
                },
                derivedHints: 'tenant_derived',
              },
            },
          },
        })),
      } as any,
    );

    const view = await service.getKnowledgeView();

    expect(view.scope).toBe('active_corpus');
    expect(view.support).toEqual(
      expect.objectContaining({
        topics: ['CORTINAS DE ENROLLAR'],
        supportedAxes: ['materials'],
        unspecifiedAxes: ['exact_color_options'],
      }),
    );
    expect(view.claims).toEqual([
      expect.objectContaining({
        axis: 'materials',
        supportClass: 'explicit_fact',
        extractionScope: 'tenant_only',
        values: ['PVC', 'aluminio'],
        provenance: [
          expect.objectContaining({
            documentId: 'doc-1',
            documentTitle: 'Catalogo',
            section: 'CORTINAS DE ENROLLAR',
          }),
        ],
      }),
    ]);
    expect(view.entities).toEqual([
      expect.objectContaining({
        label: 'material',
        extractionScope: 'tenant_only',
        values: ['PVC'],
      }),
    ]);
    expect(view.extractionProfiles).toEqual([
      expect.objectContaining({
        profileId: 'product_catalog',
        tenantDerivedApplied: true,
      }),
    ]);
    expect(view.overviewLines[0]).toContain('materiales');
  });

  it('refreshes with the latest extracted data when active documentation changes', async () => {
    let axisValue = 'PVC';
    const service = new DocumentKnowledgeViewService(
      {
        findById: jest.fn(),
      } as any,
      {
        listActiveReadyChunks: jest.fn(async () => [
          {
            sequence: 0,
            metadata: {
              supportSummary: {
                topic: 'CORTINAS DE ENROLLAR',
                supportedAxes: ['materials'],
                unspecifiedAxes: [],
              },
            },
            document: {
              id: 'doc-1',
              title: 'Catalogo',
              status: 'ACTIVE',
              ingestionStatus: 'READY',
              language: 'es',
              sourceName: 'catalogo.txt',
              originKind: 'TEXT',
              updatedAt: new Date('2026-04-05T01:00:00.000Z'),
            },
            knowledgeItems: [
              {
                kind: 'CLAIM',
                label: 'materials',
                valueText: axisValue,
                normalizedValue: axisValue.toLowerCase(),
                supportClass: 'EXPLICIT_FACT',
                evidenceTextSpan: `Disponible en ${axisValue}.`,
                metadata: {
                  extractionScope: 'tenant_only',
                  profileKey: 'product_catalog',
                  claim: {
                    axis: 'materials',
                    kind: 'value_list',
                    values: [axisValue],
                  },
                },
              },
            ],
          },
        ]),
      } as any,
      {
        resolveEffectiveConfigs: jest.fn(async () => ({
          product_catalog: {
            profileId: 'product_catalog',
            locale: 'es',
            derivedHints: {
              observedAxes: ['materials'],
            },
            resolution: {
              tenantDerivedApplied: true,
              derivedFromDocuments: [
                {
                  documentId: 'doc-1',
                  title: 'Catalogo',
                  updatedAt: '2026-04-05T01:00:00.000Z',
                },
              ],
              sources: {
                axes: {
                  materials: 'mixed',
                },
                matchingHints: {
                  listStopTerms: 'platform_default',
                },
                derivedHints: 'tenant_derived',
              },
            },
          },
        })),
      } as any,
    );

    const first = await service.getKnowledgeView();
    axisValue = 'aluminio';
    const second = await service.getKnowledgeView();

    expect(first.claims[0].values).toEqual(['PVC']);
    expect(second.claims[0].values).toEqual(['aluminio']);
  });
});
