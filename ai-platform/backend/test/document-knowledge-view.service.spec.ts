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
                kind: 'CLAIM',
                label: 'exact_color_options',
                valueText: 'requires_confirmation',
                normalizedValue: 'requires confirmation',
                supportClass: 'PARTIAL_FACT',
                evidenceTextSpan:
                  'No afirmar colores o texturas especificas si no estan confirmadas.',
                metadata: {
                  extractionScope: 'domain_profile',
                  profileKey: 'product_catalog',
                  unspecifiedAxes: ['exact_color_options'],
                  claim: {
                    axis: 'exact_color_options',
                    kind: 'coverage_gap',
                    layer: 'prudence',
                    values: ['requires_confirmation'],
                  },
                },
              },
              {
                kind: 'CLAIM',
                label: 'quote_fields',
                valueText: 'ancho y alto aproximado',
                normalizedValue: 'ancho y alto aproximado',
                supportClass: 'EXPLICIT_FACT',
                evidenceTextSpan: 'Datos utiles para presupuesto: ancho y alto aproximado.',
                metadata: {
                  extractionScope: 'domain_profile',
                  profileKey: 'product_catalog',
                  claim: {
                    axis: 'quote_fields',
                    kind: 'workflow_signal',
                    layer: 'workflow',
                    values: ['ancho y alto aproximado'],
                  },
                },
              },
              {
                kind: 'CLAIM',
                label: 'informative_flow',
                valueText:
                  'primero explicamos el producto | no pasamos directo a cotizacion',
                normalizedValue:
                  'primero explicamos el producto no pasamos directo a cotizacion',
                supportClass: 'EXPLICIT_FACT',
                evidenceTextSpan:
                  'Si la consulta es informativa: primero explicamos el producto. No pasamos directo a cotización.',
                metadata: {
                  extractionScope: 'tenant_only',
                  profileKey: 'product_catalog',
                  claim: {
                    axis: 'informative_flow',
                    kind: 'guidance_signal',
                    layer: 'guidance',
                    values: [
                      'primero explicamos el producto',
                      'no pasamos directo a cotizacion',
                    ],
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
            propositions: [
              {
                predicate: 'materials',
                facet: null,
                objectValue: 'PVC',
                objectNormalized: 'pvc',
                polarity: 'AFFIRMED',
                supportClass: 'EXPLICIT_FACT',
                evidenceTier: 'NORMALIZED_PROPOSITION',
                confidence: 0.92,
                relationScope: [],
                metadata: {
                  extractionScope: 'tenant_only',
                  profileKey: 'product_catalog',
                  claim: {
                    axis: 'materials',
                    layer: 'factual',
                  },
                },
                patternKey: 'materials||affirmed|subject:none|scopes:',
                canonicalKey: 'materials-pvc',
                promotionState: 'UNCLASSIFIED',
                promotedAxis: null,
                promotedFacet: null,
                evidenceTextSpan: 'Disponibles en PVC y aluminio.',
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
    expect(view.counts.propositionCount).toBe(1);
    expect(view.support).toEqual(
      expect.objectContaining({
        topics: ['CORTINAS DE ENROLLAR'],
        supportedAxes: expect.arrayContaining([
          'materials',
          'exact_color_options',
          'quote_fields',
        ]),
        unspecifiedAxes: ['exact_color_options'],
      }),
    );
    expect(view.claims).toEqual([
      expect.objectContaining({
        axis: 'materials',
        layer: 'factual',
        supportClass: 'explicit_fact',
        extractionScope: 'tenant_only',
        appliesTo: [],
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
    expect(view.propositions).toEqual([
      expect.objectContaining({
        predicate: 'materials',
        evidenceTier: 'normalized_proposition',
        polarity: 'affirmed',
        objectValue: 'PVC',
      }),
    ]);
    expect(view.prudenceNotes).toEqual([
      expect.objectContaining({
        axis: 'exact_color_options',
        layer: 'prudence',
        values: ['requires_confirmation'],
      }),
    ]);
    expect(view.workflowNotes).toEqual([
      expect.objectContaining({
        axis: 'quote_fields',
        layer: 'workflow',
        values: ['ancho y alto aproximado'],
      }),
    ]);
    expect(view.guidanceNotes).toEqual([
      expect.objectContaining({
        axis: 'informative_flow',
        layer: 'guidance',
        values: [
          'primero explicamos el producto',
          'no pasamos directo a cotizacion',
        ],
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

  it('composes the active corpus by role and layer instead of using the last active document globally', async () => {
    const service = new DocumentKnowledgeViewService(
      {
        findById: jest.fn(),
      } as any,
      {
        listActiveReadyChunks: jest.fn(async () => [
          {
            documentId: 'doc-guide',
            sequence: 0,
            metadata: {
              supportSummary: {
                topic: 'FORMA DE TRABAJO',
                supportedAxes: ['informative_flow'],
                unspecifiedAxes: [],
              },
            },
            document: {
              id: 'doc-guide',
              title: 'Documento Guia',
              status: 'ACTIVE',
              ingestionStatus: 'READY',
              language: 'es',
              sourceName: 'guia.txt',
              originKind: 'TEXT',
              metadata: {
                documentRole: 'operational_guide',
                documentLayers: ['workflow', 'guidance'],
              },
              updatedAt: new Date('2026-04-05T20:00:00.000Z'),
            },
            knowledgeItems: [
              {
                kind: 'CLAIM',
                label: 'informative_flow',
                valueText: 'primero explicamos el producto',
                normalizedValue: 'primero explicamos el producto',
                supportClass: 'EXPLICIT_FACT',
                evidenceTextSpan: 'Primero explicamos el producto.',
                metadata: {
                  extractionScope: 'tenant_only',
                  profileKey: 'product_catalog',
                  claim: {
                    axis: 'informative_flow',
                    kind: 'guidance_signal',
                    layer: 'guidance',
                    values: ['primero explicamos el producto'],
                  },
                },
              },
            ],
          },
          {
            documentId: 'doc-master',
            sequence: 0,
            metadata: {
              supportSummary: {
                topic: 'PERFIL COMERCIAL',
                supportedAxes: ['coverage_locations'],
                unspecifiedAxes: [],
              },
            },
            document: {
              id: 'doc-master',
              title: 'Documento Maestro',
              status: 'ACTIVE',
              ingestionStatus: 'READY',
              language: 'es',
              sourceName: 'maestro.txt',
              originKind: 'TEXT',
              metadata: {
                documentRole: 'factual_master',
                documentLayers: ['factual'],
              },
              updatedAt: new Date('2026-04-05T18:00:00.000Z'),
            },
            knowledgeItems: [
              {
                kind: 'CLAIM',
                label: 'coverage_locations',
                valueText: 'todo el pais',
                normalizedValue: 'todo el pais',
                supportClass: 'EXPLICIT_FACT',
                evidenceTextSpan: 'Atendemos consultas e instalaciones en todo el país.',
                metadata: {
                  extractionScope: 'tenant_only',
                  profileKey: 'product_catalog',
                  claim: {
                    axis: 'coverage_locations',
                    kind: 'relational_fact',
                    values: ['todo el pais'],
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
            derivedHints: null,
            resolution: {
              tenantDerivedApplied: false,
              derivedFromDocuments: [],
              sources: {
                axes: {},
                matchingHints: {},
                derivedHints: 'platform_default',
              },
            },
          },
        })),
      } as any,
    );

    const view = await service.getKnowledgeView();

    expect(view.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'doc-guide',
          title: 'Documento Guia',
          corpusRole: 'operational_guide',
        }),
        expect.objectContaining({
          id: 'doc-master',
          title: 'Documento Maestro',
          corpusRole: 'factual_master',
        }),
      ]),
    );
    expect(view.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          axis: 'coverage_locations',
          values: ['todo el pais'],
          provenance: [expect.objectContaining({ documentId: 'doc-master' })],
        }),
      ]),
    );
    expect(view.guidanceNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          axis: 'informative_flow',
          values: ['primero explicamos el producto'],
          provenance: [expect.objectContaining({ documentId: 'doc-guide' })],
        }),
      ]),
    );
  });
});
