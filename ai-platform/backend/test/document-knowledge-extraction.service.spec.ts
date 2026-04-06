import { DocumentKnowledgeExtractionService } from '../src/modules/documents/document-knowledge-extraction.service';

describe('DocumentKnowledgeExtractionService', () => {
  it('keeps the base extractor neutral when no domain extraction profile is active', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        'CORTINAS DE ENROLLAR',
        '',
        'Disponibles en PVC y aluminio, con opciones manuales o motorizadas.',
        'Variedad de colores.',
        'Ideal para exteriores.',
        '',
        'Tipos: Roller Screen, Roller Blackout y Roller Doble.',
      ].join('\n'),
      originKind: 'TEXT',
      sourceMetadata: {
        sourceName: 'catalogo.txt',
      },
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        retrievalProjection: expect.stringContaining('cortinas de enrollar'),
        metadata: expect.objectContaining({
          section: 'CORTINAS DE ENROLLAR',
          originKind: 'TEXT',
          supportSummary: expect.objectContaining({
            topic: 'CORTINAS DE ENROLLAR',
            supportedAxes: [],
            unspecifiedAxes: [],
          }),
        }),
        structuredItems: [],
      }),
    );
  });

  it('builds product/catalog structured claims only when the profile is active', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        '1. PERFIL COMERCIAL',
        '',
        'Medios de pago:',
        '',
        '- WalletPay',
        '- transferencia',
        '- hasta 6 cuotas sin interes por WalletPay',
        '',
        'Horario de atencion:',
        '',
        'No confirmar un horario exacto si no hay una fuente unificada.',
        '',
        '4. SISTEMAS ENROLLABLES',
        '',
        'Disponibles en material alfa y material beta, con opciones manuales o automatizadas.',
        'Tipos: Linea Solar, Linea Sombra y Linea Duo.',
        '',
        '4.1. SISTEMA ENROLLABLE EN MATERIAL ALFA',
        '',
        'Color: nieve',
        '',
        '4.2. SISTEMA ENROLLABLE EN MATERIAL BETA',
        '',
        'Variedad de colores.',
        'Ideal para exterior.',
        '',
        'Datos para presupuesto:',
        '',
        '- ancho aproximado',
        '- alto aproximado',
        '- accionamiento deseado',
      ].join('\n'),
      originKind: 'TEXT',
      sourceMetadata: {
        sourceName: 'catalogo.txt',
      },
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
      },
    });

    const allItems = chunks.flatMap((chunk) => chunk.structuredItems ?? []);
    const materialsClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'materials' &&
        item.metadata?.claim?.values?.includes('material alfa') &&
        item.metadata?.claim?.values?.includes('material beta'),
    );
    const pvcColorClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'color_options' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'material' &&
            scope.normalizedValue === 'material alfa',
        ),
    );
    const aluminumColorCoverage = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'color_options' &&
        item.supportClass === 'partial_fact' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'material' &&
            scope.normalizedValue === 'material beta',
        ),
    );
    const exactColorsPrudence = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'exact_color_options' &&
        item.metadata?.claim?.layer === 'prudence',
    );
    const installmentClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'installment_count' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'payment_method' &&
            scope.normalizedValue === 'walletpay',
        ),
    );
    const paymentTermsInstallmentClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'payment_terms' &&
        item.metadata?.claim?.facet === 'installment_count' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'payment_method' &&
            scope.normalizedValue === 'walletpay',
        ),
    );
    const workflowClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'quote_fields' &&
        item.metadata?.claim?.layer === 'workflow',
    );
    const hoursPrudence = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'exact_hours' &&
        item.metadata?.claim?.layer === 'prudence',
    );

    expect(
      chunks.some((chunk) =>
        chunk.retrievalProjection.includes('material alfa'),
      ),
    ).toBe(true);
    expect(
      chunks.some((chunk) =>
        Array.isArray(chunk.metadata?.extractionProfiles) &&
        chunk.metadata.extractionProfiles.includes('product_catalog'),
      ),
    ).toBe(true);
    expect(materialsClaim).toEqual(
      expect.objectContaining({
        supportClass: 'explicit_fact',
        metadata: expect.objectContaining({
          extractionScope: 'tenant_only',
          profileKey: 'product_catalog',
          claim: expect.objectContaining({
            axis: 'materials',
            kind: 'relational_fact',
            layer: 'factual',
            values: ['material alfa', 'material beta'],
          }),
        }),
      }),
    );
    expect(pvcColorClaim).toEqual(
      expect.objectContaining({
        valueText: 'nieve',
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'color_options',
            layer: 'factual',
            appliesTo: expect.arrayContaining([
              expect.objectContaining({
                axis: 'material',
                normalizedValue: 'material alfa',
              }),
            ]),
            values: ['nieve'],
          }),
        }),
      }),
    );
    expect(aluminumColorCoverage).toEqual(
      expect.objectContaining({
        valueText: 'variety',
        metadata: expect.objectContaining({
          extractionScope: 'domain_profile',
          unspecifiedAxes: ['exact_color_options'],
        }),
      }),
    );
    expect(exactColorsPrudence).toEqual(
      expect.objectContaining({
        valueText: 'not_specified',
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'exact_color_options',
            layer: 'prudence',
          }),
        }),
      }),
    );
    expect(installmentClaim).toEqual(
      expect.objectContaining({
        valueText: '6',
        metadata: expect.objectContaining({
          extractionScope: 'tenant_only',
          claim: expect.objectContaining({
            axis: 'installment_count',
            layer: 'factual',
            appliesTo: expect.arrayContaining([
              expect.objectContaining({
                axis: 'payment_method',
                normalizedValue: 'walletpay',
              }),
            ]),
          }),
        }),
      }),
    );
    expect(paymentTermsInstallmentClaim).toEqual(
      expect.objectContaining({
        valueText: '6',
        metadata: expect.objectContaining({
          extractionScope: 'tenant_only',
          claim: expect.objectContaining({
            axis: 'payment_terms',
            facet: 'installment_count',
            layer: 'factual',
            appliesTo: expect.arrayContaining([
              expect.objectContaining({
                axis: 'payment_method',
                normalizedValue: 'walletpay',
              }),
            ]),
          }),
        }),
      }),
    );
    expect(workflowClaim).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'quote_fields',
            layer: 'workflow',
          }),
        }),
      }),
    );
    expect(hoursPrudence).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'exact_hours',
            layer: 'prudence',
          }),
        }),
      }),
    );
    const paymentTermProposition = chunks
      .flatMap((chunk) => chunk.structuredPropositions ?? [])
      .find(
        (proposition) =>
          proposition.proposition.predicate === 'payment_terms' &&
          proposition.proposition.facet === 'installment_count' &&
          proposition.proposition.objectValue === '6',
      );

    expect(paymentTermProposition).toEqual(
      expect.objectContaining({
        label: 'payment_terms',
        supportClass: 'explicit_fact',
        proposition: expect.objectContaining({
          predicate: 'payment_terms',
          facet: 'installment_count',
          objectValue: '6',
          polarity: 'affirmed',
          evidenceTier: 'normalized_proposition',
          patternKey: expect.stringContaining('payment_terms'),
          canonicalKey: expect.any(String),
        }),
      }),
    );
  });

  it('persists normalized propositions for negative feature support without discarding the claim evidence', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        'ABERTURAS EN ALUMINIO',
        '',
        'SERIE 25',
        '',
        'No soporta DVH.',
        '',
        'SERIE PROBBA',
        '',
        'Admite vidrio simple o DVH.',
      ].join('\n'),
      originKind: 'TEXT',
      sourceMetadata: {
        sourceName: 'aberturas.txt',
      },
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
      },
    });

    const propositions = chunks.flatMap((chunk) => chunk.structuredPropositions ?? []);
    const negatedSupport = propositions.find(
      (proposition) =>
        proposition.proposition.predicate === 'feature_support' &&
        proposition.proposition.polarity === 'negated' &&
        proposition.proposition.objectValue === 'DVH',
    );
    const affirmedSupport = propositions.find(
      (proposition) =>
        proposition.proposition.predicate === 'feature_support' &&
        proposition.proposition.polarity === 'affirmed' &&
        proposition.proposition.objectValue === 'DVH',
    );

    expect(negatedSupport).toEqual(
      expect.objectContaining({
        proposition: expect.objectContaining({
          predicate: 'feature_support',
          polarity: 'negated',
          objectValue: 'DVH',
        }),
      }),
    );
    expect(affirmedSupport).toEqual(
      expect.objectContaining({
        proposition: expect.objectContaining({
          predicate: 'feature_support',
          polarity: 'affirmed',
          objectValue: 'DVH',
        }),
      }),
    );
  });

  it('lets tenant-derived section aliases refine extraction within the selected profile without changing core defaults', () => {
    const service = new DocumentKnowledgeExtractionService();
    const sourceText = [
      '1. PERFIL COMERCIAL',
      '',
      'Opciones de cobro:',
      '',
      '- WalletPay',
      '- transferencia',
    ].join('\n');

    const withoutDerivedAliases = service.buildChunkCandidates({
      sourceText,
      originKind: 'TEXT',
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
      },
    });
    const withDerivedAliases = service.buildChunkCandidates({
      sourceText,
      originKind: 'TEXT',
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
        profileConfigHints: {
          product_catalog: {
            sectionAliasesByAxis: {
              payment_methods: ['Opciones de cobro'],
            },
          },
        },
      },
    });

    expect(
      withoutDerivedAliases
        .flatMap((chunk) => chunk.structuredItems ?? [])
        .some((item) => item.kind === 'claim' && item.label === 'payment_methods'),
    ).toBe(false);
    expect(
      withDerivedAliases
        .flatMap((chunk) => chunk.structuredItems ?? [])
        .filter((item) => item.kind === 'claim' && item.label === 'payment_methods'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'payment_methods',
              layer: 'factual',
              values: ['WalletPay'],
            }),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'payment_methods',
              layer: 'factual',
              values: ['transferencia'],
            }),
          }),
        }),
      ]),
    );
  });

  it('extracts internal construction components as relational claims scoped to the active product variant', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        '7. PERSIANAS Y CORTINAS DE ENROLLAR',
        '',
        '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
        '',
        'Características:',
        '- lamas de aluminio',
        '- relleno de espuma de poliuretano',
      ].join('\n'),
      originKind: 'TEXT',
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
      },
    });

    const allItems = chunks.flatMap((chunk) => chunk.structuredItems ?? []);
    const componentClaims = allItems.filter(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'construction_components' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'material' &&
            scope.normalizedValue === 'aluminio',
        ),
    );

    expect(componentClaims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueText: 'lamas de aluminio',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'construction_components',
              layer: 'factual',
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'material',
                  normalizedValue: 'aluminio',
                }),
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          valueText: 'relleno de espuma de poliuretano',
        }),
      ]),
    );
  });

  it('extracts scoped claims from master-style numbered sections and heading lists', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        '======================================================================',
        '3. PRESUPUESTO, PAGOS Y CONFIRMACION',
        '======================================================================',
        '',
        'Medios de pago:',
        '- transferencia bancaria',
        '- efectivo',
        '- Mercado Pago',
        '- tarjetas',
        '',
        'Mercado Pago:',
        'Mercado Pago ofrece hasta 12 cuotas con tarjetas VISA, Mastercard, OCA y Creditel.',
        '',
        '======================================================================',
        '7. PERSIANAS Y CORTINAS DE ENROLLAR',
        '======================================================================',
        '',
        '----------------------------------------------------------------------',
        '7.1. PERSIANA O CORTINA DE ENROLLAR EN PVC',
        '----------------------------------------------------------------------',
        '',
        'Características:',
        '- color blanco',
        '- opción manual o motorizada',
        '',
        'Datos útiles para presupuesto:',
        '- ancho y alto aproximado',
        '- si es instalación nueva o reemplazo',
        '',
        '----------------------------------------------------------------------',
        '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
        '----------------------------------------------------------------------',
        '',
        'Características:',
        '- variedad de colores(blanco negro marron color madera gris verde)',
        '- opción manual o motorizada',
        '',
        '======================================================================',
        '2. FORMA DE TRABAJO',
        '======================================================================',
        '',
        'Horario de atención:',
        'Si hace falta confirmar un horario exacto, lo mejor es validarlo al momento de responder.',
        '',
        '======================================================================',
        '14. COMO SOLEMOS AVANZAR UNA CONSULTA',
        '======================================================================',
        '',
        'Si la consulta es informativa:',
        '- primero explicamos el producto',
        '- no pasamos directo a cotización',
        '',
        'Si la consulta pasa a presupuesto:',
        '- confirmamos el producto',
        '- pedimos medidas aproximadas',
        '- pedimos cantidad',
        '',
        'Si hace falta una confirmación puntual, se consulta y se detalla a la brevedad:',
        '- disponibilidad puntual de colores o texturas',
        '- garantía exacta de la línea elegida',
        '',
        '======================================================================',
        '15. RESPUESTAS ORGANICAS PARA SITUACIONES FRECUENTES',
        '======================================================================',
        '',
        'Instalación:',
        'Sí, realizamos instalación con nuestro equipo.',
        '',
        'Recomendación entre Serie 25, Probba y Gala:',
        'Serie 25 es una opción más estándar. Probba es una línea intermedia. Gala es una línea más fuerte y de mejor prestación general.',
      ].join('\n'),
      originKind: 'TEXT',
      language: 'es',
      sourceMetadata: {
        sourceName: 'documento-maestro.txt',
      },
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
        locale: 'es',
      },
    });

    const allItems = chunks.flatMap((chunk) => chunk.structuredItems ?? []);

    expect(allItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'payment_methods',
          valueText: 'transferencia bancaria',
        }),
        expect.objectContaining({
          label: 'payment_methods',
          valueText: 'Mercado Pago',
        }),
        expect.objectContaining({
          label: 'installment_count',
          valueText: '12',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'payment_method',
                  normalizedValue: 'mercado pago',
                }),
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'payment_terms',
          valueText: '12',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'payment_terms',
              facet: 'installment_count',
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'payment_method',
                  normalizedValue: 'mercado pago',
                }),
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'payment_terms',
          valueText: 'VISA | Mastercard | OCA | Creditel',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'payment_terms',
              facet: 'card_brands',
              values: ['VISA', 'Mastercard', 'OCA', 'Creditel'],
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'payment_method',
                  normalizedValue: 'mercado pago',
                }),
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'color_options',
          valueText: 'blanco',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'material',
                  normalizedValue: 'pvc',
                }),
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'color_options',
          valueText: 'blanco | negro | marron | color madera | gris | verde',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'material',
                  normalizedValue: 'aluminio',
                }),
              ]),
              values: [
                'blanco',
                'negro',
                'marron',
                'color madera',
                'gris',
                'verde',
              ],
            }),
          }),
        }),
        expect.objectContaining({
          label: 'quote_fields',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              layer: 'workflow',
              subject: expect.objectContaining({
                value: 'PERSIANA O CORTINA DE ENROLLAR',
              }),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'exact_hours',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              layer: 'prudence',
            }),
          }),
        }),
        expect.objectContaining({
          label: 'informative_flow',
          metadata: expect.objectContaining({
            extractionScope: 'tenant_only',
            claim: expect.objectContaining({
              layer: 'guidance',
              values: [
                'primero explicamos el producto',
                'no pasamos directo a cotización',
              ],
            }),
          }),
        }),
        expect.objectContaining({
          label: 'quote_transition',
          metadata: expect.objectContaining({
            extractionScope: 'tenant_only',
            claim: expect.objectContaining({
              layer: 'guidance',
              values: expect.arrayContaining([
                'confirmamos el producto',
                'pedimos medidas aproximadas',
                'pedimos cantidad',
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'confirmation_policy',
          metadata: expect.objectContaining({
            extractionScope: 'tenant_only',
            claim: expect.objectContaining({
              layer: 'guidance',
              values: expect.arrayContaining([
                'disponibilidad puntual de colores o texturas',
                'garantía exacta de la línea elegida',
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'organic_response_pattern',
          metadata: expect.objectContaining({
            extractionScope: 'tenant_only',
            claim: expect.objectContaining({
              layer: 'guidance',
            }),
          }),
        }),
        expect.objectContaining({
          label: 'comparison_guidance',
          metadata: expect.objectContaining({
            extractionScope: 'tenant_only',
            claim: expect.objectContaining({
              layer: 'guidance',
              subject: expect.objectContaining({
                value: 'Serie 25, Probba y Gala',
              }),
            }),
          }),
        }),
      ]),
    );
  });

  it('extracts feature compatibility statements and limitations from descriptive section prose', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        '12. ABERTURAS EN ALUMINIO',
        '',
        '12.1. SERIE 20 Y 25',
        '',
        'Las Series 20 y 25 son nuestras opciones estándar. Estas series no soportan DVH.',
        'Serie 25 aparece más ligada a vidrio simple y a soluciones estándar.',
        '',
        '12.2. SERIE PROBBA',
        '',
        'La Serie Probba es una línea de alta prestación.',
        'Características:',
        '- admite vidrio simple o DVH',
      ].join('\n'),
      originKind: 'TEXT',
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
      },
    });

    const allItems = chunks.flatMap((chunk) => chunk.structuredItems ?? []);
    const negativeCompatibilityClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'feature_support' &&
        item.metadata?.claim?.subject?.normalizedValue === 'serie 20 y 25' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'support_state' &&
            scope.normalizedValue === 'does not support',
        ) &&
        item.metadata?.claim?.values?.includes('DVH'),
    );
    const positiveCompatibilityClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'feature_support' &&
        item.metadata?.claim?.subject?.normalizedValue === 'serie probba' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'support_state' &&
            scope.normalizedValue === 'supports',
        ) &&
        item.metadata?.claim?.values?.includes('DVH'),
    );

    expect(negativeCompatibilityClaim).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'feature_support',
            layer: 'factual',
            values: expect.arrayContaining(['DVH', 'doble vidrio']),
          }),
        }),
      }),
    );
    expect(positiveCompatibilityClaim).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'feature_support',
            layer: 'factual',
            values: expect.arrayContaining(['DVH', 'doble vidrio', 'vidrio simple']),
          }),
        }),
      }),
    );
  });

  it('extracts visit, rectification, installation, and visit-cost facts from service-oriented document prose', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        '3. INSTALACION Y COBERTURA',
        '',
        'En Montevideo podemos coordinar visitas comerciales y técnicas según el tipo de trabajo.',
        'Las visitas dentro de Montevideo son sin costo.',
        'Fuera de Montevideo puede corresponder costo de traslado.',
        '',
        '15. RESPUESTAS ORGANICAS PARA SITUACIONES FRECUENTES',
        '',
        'Visita previa:',
        'Sí, podemos coordinar una primera visita para mostrarte el producto y rectificar medidas antes de definir el trabajo final.',
        '',
        'Instalación:',
        'Sí, realizamos instalación con nuestro equipo.',
      ].join('\n'),
      originKind: 'TEXT',
      language: 'es',
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
        locale: 'es',
      },
    });

    const allItems = chunks.flatMap((chunk) => chunk.structuredItems ?? []);
    const serviceClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'service_offers' &&
        item.metadata?.claim?.values?.includes('visita a domicilio') &&
        item.metadata?.claim?.values?.includes('toma de medidas'),
    );
    const installationClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'service_offers' &&
        item.metadata?.claim?.values?.includes('instalacion'),
    );
    const visitCostClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'commercial_visit_cost' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'location' &&
            scope.normalizedValue === 'montevideo',
        ),
    );
    const travelCostClaim = allItems.find(
      (item) =>
        item.kind === 'claim' &&
        item.label === 'travel_cost_responsibility' &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'location' &&
            scope.normalizedValue === 'montevideo',
        ) &&
        item.metadata?.claim?.appliesTo?.some(
          (scope) =>
            scope.axis === 'location_relation' &&
            scope.normalizedValue === 'outside',
        ) &&
        item.metadata?.claim?.values?.includes('puede corresponder costo de traslado'),
    );

    expect(serviceClaim).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'service_offers',
            layer: 'factual',
            values: expect.arrayContaining(['visita a domicilio', 'toma de medidas']),
          }),
        }),
      }),
    );
    expect(installationClaim).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'service_offers',
            values: expect.arrayContaining(['instalacion']),
          }),
        }),
      }),
    );
    expect(visitCostClaim).toEqual(
      expect.objectContaining({
        valueText: 'sin costo',
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'commercial_visit_cost',
          }),
        }),
      }),
    );
    expect(travelCostClaim).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          claim: expect.objectContaining({
            axis: 'travel_cost_responsibility',
            values: ['puede corresponder costo de traslado'],
          }),
        }),
      }),
    );
  });

  it('extracts factual scoped variants from compact criteria sections with child headings', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        '7. CORTINAS DE ENROLLAR - CRITERIOS DE ATENCION',
        '',
        'En cortinas de enrollar la comparacion entre PVC y aluminio es una consulta muy frecuente.',
        '',
        'PVC:',
        '- alternativa mas economica y funcional',
        '- en varias situaciones se trabaja solamente en color blanco',
        '',
        'Aluminio:',
        '- alternativa mas robusta y durable',
        '- mejor nivel de prestacion',
        '',
        '8. ROLLER Y CORTINAS INTERIORES - CRITERIOS DE ATENCION',
        '',
        'Screen:',
        '- mejor cuando se busca luz natural',
        '',
        'Blackout:',
        '- mejor cuando se busca oscuridad',
      ].join('\n'),
      originKind: 'TEXT',
      language: 'es',
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
        locale: 'es',
      },
    });

    const allItems = chunks.flatMap((chunk) => chunk.structuredItems ?? []);

    expect(allItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'materials',
          valueText: 'PVC',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'materials',
              layer: 'factual',
              subject: expect.objectContaining({
                normalizedValue: 'cortinas de enrollar criterios de atencion',
              }),
              values: ['PVC'],
            }),
          }),
        }),
        expect.objectContaining({
          label: 'materials',
          valueText: 'Aluminio',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'materials',
              layer: 'factual',
              subject: expect.objectContaining({
                normalizedValue: 'cortinas de enrollar criterios de atencion',
              }),
              values: ['Aluminio'],
            }),
          }),
        }),
        expect.objectContaining({
          label: 'product_types',
          valueText: 'Screen',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'product_types',
              layer: 'factual',
              subject: expect.objectContaining({
                normalizedValue: 'roller y cortinas interiores criterios de atencion',
              }),
              values: ['Screen'],
            }),
          }),
        }),
        expect.objectContaining({
          label: 'product_types',
          valueText: 'Blackout',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              axis: 'product_types',
              layer: 'factual',
              values: ['Blackout'],
            }),
          }),
        }),
      ]),
    );
  });

  it('extracts warranty claims as scoped factual knowledge instead of leaving them only as free text', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        '4. GARANTIAS',
        '',
        'La garantía depende del producto.',
        'En distintas líneas de aluminio y roller trabajamos habitualmente con 2 años.',
        'En varias opciones de PVC la referencia más frecuente es 1 año.',
      ].join('\n'),
      originKind: 'TEXT',
      language: 'es',
      extractionContext: {
        activeCapabilities: ['product_catalog_lookup'],
        locale: 'es',
      },
    });

    const allItems = chunks.flatMap((chunk) => chunk.structuredItems ?? []);

    expect(allItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'warranty_terms',
          valueText: '2 años',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'material',
                  normalizedValue: 'aluminio',
                }),
              ]),
            }),
          }),
        }),
        expect.objectContaining({
          label: 'warranty_terms',
          valueText: '1 año',
          metadata: expect.objectContaining({
            claim: expect.objectContaining({
              appliesTo: expect.arrayContaining([
                expect.objectContaining({
                  axis: 'material',
                  normalizedValue: 'pvc',
                }),
              ]),
            }),
          }),
        }),
      ]),
    );
  });
});
