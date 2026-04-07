import { ChatResponsePolicyService } from '../src/modules/response/chat-response-policy.service';
import { ResponseGroundingService } from '../src/modules/response/response-grounding.service';

describe('ChatResponsePolicyService', () => {
  const service: any = new ChatResponsePolicyService({
    render: jest.fn(
      async (input: {
        locale?: string;
        templateKey: string;
        variables?: Record<string, string | number | null | undefined>;
      }) => {
        const templates = buildCatalog(input.locale).templates as Record<
          string,
          string
        >;
        return templates[input.templateKey].replace(
          /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
          (_match, key: string) => String(input.variables?.[key] ?? ''),
        );
      },
    ),
    getDefaults: jest.fn(async (locale?: string) => buildCatalog(locale).defaults),
    getActionLabel: jest.fn(
      async (locale: string | undefined, toolName: string | null | undefined) => {
        const labels = buildCatalog(locale).actionLabels;

        if (toolName === 'create_booking') {
          return labels.create_booking;
        }

        if (toolName === 'create_quote') {
          return labels.create_quote;
        }

        if (toolName === 'get_product') {
          return labels.get_product;
        }

        return labels.default;
      },
    ),
    startsWithGreeting: jest.fn(async (locale: string | undefined, value: string) => {
      const normalized = value.trim().toLowerCase();
      return buildCatalog(locale).greetingCues.some((cue) =>
        normalized.startsWith(cue),
      );
    }),
  } as any, new ResponseGroundingService());

  it('returns a grounded booking confirmation after successful execution', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Reservar para manana',
        intent: 'CREATE_BOOKING',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'create_booking',
          validatedInputSummary: {
            requestedDateIso: '2026-04-04T12:00:00.000Z',
          },
          resultSummary: {
            bookingId: 'bk_12345678',
            scheduledFor: '2026-04-04T12:00:00.000Z',
            status: 'confirmed',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['bookingId', 'scheduledFor', 'status'],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe('La reserva fue confirmada para 2026-04-04T12:00:00.000Z.');
  });

  it('returns a grounded quote confirmation after successful execution', async () => {
    await expect(
      service.resolve({
        locale: 'en',
        userMessage: 'Need a quote',
        intent: 'CREATE_QUOTE',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_quote',
          reasonCode: 'quote_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.quote.confirmation',
        },
        interpretation: {
          language: 'en',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'create_quote',
          validatedInputSummary: {
            requestSummary: 'Need a quote',
          },
          resultSummary: {
            quoteId: 'qt_12345678',
            estimatedTotal: 144,
            currency: 'USD',
            status: 'drafted',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['quoteId', 'estimatedTotal', 'currency', 'status'],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe('The preliminary quote was created for USD 144.00.');
  });

  it('returns a grounded product result after successful execution', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Beacon Desk Lamp',
        intent: 'GET_PRODUCT',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'get_product',
          reasonCode: 'product_lookup_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.ecommerce.product_result',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'get_product',
          validatedInputSummary: {
            query: 'Beacon Desk Lamp',
          },
          resultSummary: {
            sku: 'B-77',
            name: 'Beacon Desk Lamp',
            price: 89,
            currency: 'USD',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['sku', 'name', 'price', 'currency'],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe('Encontré Beacon Desk Lamp por USD 89.00.');
  });

  it('returns a deterministic validation failure response without claiming success', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Reservar',
        intent: 'CREATE_BOOKING',
        outcome: 'execution_failed',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'failed',
          toolName: 'create_booking',
          validatedInputSummary: null,
          resultSummary: null,
          failure: {
            code: 'validation_failed',
            message: 'Tool input validation failed.',
            details: null,
          },
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe(
      'No pude completar la reserva solicitada con la información disponible.',
    );
  });

  it('returns a deterministic unknown-tool failure response without claiming success', async () => {
    await expect(
      service.resolve({
        locale: 'en',
        userMessage: 'do the thing',
        intent: 'GET_PRODUCT',
        outcome: 'execution_failed',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'get_product',
          reasonCode: 'product_lookup_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.ecommerce.product_result',
        },
        interpretation: {
          language: 'en',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'failed',
          toolName: 'missing_tool',
          validatedInputSummary: null,
          resultSummary: null,
          failure: {
            code: 'unknown_tool',
            message: 'Unknown tool',
            details: null,
          },
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe(
      'I could not complete the requested product lookup because the approved capability is not available.',
    );
  });

  it('asks only for the requested booking date when that is the only backend missing field', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Quiero agendar una visita',
        intent: 'CREATE_BOOKING',
        outcome: 'clarify',
        decision: {
          domain: 'core',
          action: 'clarify',
          reasonCode: 'booking_missing_fields',
          missingFields: ['requested_date'],
          responseTemplateKey: 'core.clarification',
        },
        interpretation: {
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'Quiero agendar una visita',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        missingFields: ['requested_date'],
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toMatch(/fecha|hora|visita/i);

    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Quiero agendar una visita',
        intent: 'CREATE_BOOKING',
        outcome: 'clarify',
        decision: {
          domain: 'core',
          action: 'clarify',
          reasonCode: 'booking_missing_fields',
          missingFields: ['requested_date'],
          responseTemplateKey: 'core.clarification',
        },
        interpretation: {
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'Quiero agendar una visita',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        missingFields: ['requested_date'],
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.not.toMatch(/objetivo|tipo de cita/i);
  });

  it('composes document grounding with booking confirmation for combined flows', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
        intent: 'CREATE_BOOKING',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        },
        interpretation: {
          language: 'es',
          confidence: 0.96,
          entities: {
            rawMessage:
              'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
            requestSummary: 'cambio de cadena de cortina roller',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'create_booking',
          validatedInputSummary: {
            requestedDateIso: '2026-04-05T11:00:00.000Z',
          },
          resultSummary: {
            bookingId: 'bk_12345678',
            scheduledFor: '2026-04-05T11:00:00.000Z',
            status: 'confirmed',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['bookingId', 'scheduledFor', 'status'],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'cambio de cadena de cortina roller',
          groundedSummary:
            'El documento indica que el cambio de cadena de cortinas roller está cubierto dentro del servicio estándar.',
          responseMode: 'combined_execution',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Cobertura Roller',
              excerpt:
                'El cambio de cadena de cortinas roller está cubierto dentro del servicio estándar.',
              sequence: 0,
              score: 4.4,
            },
          ],
        },
      }),
    ).resolves.toBe(
      'El cambio de cadena de cortinas roller está cubierto dentro del servicio estándar. La reserva fue confirmada para 2026-04-05T11:00:00.000Z.',
    );
  });

  it('keeps partially supported document answers in the middle ground instead of claiming no information at all', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: '¿Qué colores exactos tiene esta línea?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.9,
          entities: {
            rawMessage: '¿Qué colores exactos tiene esta línea?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'colores exactos de esta línea',
          groundedSummary:
            'El documento indica que esta línea ofrece una variedad de colores.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'partial',
            exactnessRequested: true,
            requestedDetailTypes: ['color_options'],
            supportedDetailTypes: [],
            partialDetailTypes: ['color_options'],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Catálogo',
              excerpt: 'Disponible en una variedad de colores.',
              sequence: 0,
              score: 3.8,
            },
          ],
        },
      }),
    ).resolves.toBe(
      'Esta línea ofrece una variedad de colores. Por ahora no tengo confirmación sobre los colores exactos.',
    );
  });

  it('uses a fluid detail-specific answer instead of repeating an off-axis list when the summary does not answer the requested detail', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: '¿Qué colores tienen las blackout?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.9,
          entities: {
            rawMessage: '¿Qué colores tienen las blackout?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'blackout colores',
          groundedSummary: 'Roller Screen, Roller Blackout, Roller Doble',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'partial',
            exactnessRequested: true,
            requestedDetailTypes: ['color_options'],
            supportedDetailTypes: [],
            partialDetailTypes: ['color_options'],
            unsupportedDetailTypes: [],
            requiredUnspecifiedDetailTypes: ['color_options'],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Catálogo',
              excerpt: 'Tipos principales: Roller Screen, Roller Blackout y Roller Doble.',
              sequence: 0,
              score: 3.2,
            },
          ],
        },
      }),
    ).resolves.toBe(
      'Depende del producto o línea. Si me indicás qué producto estás evaluando, te digo los colores exactos.',
    );
  });

  it('rewrites third-person company voice into direct customer-facing wording', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: '¿Tienen cortinas roller?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.9,
          entities: {
            rawMessage: '¿Tienen cortinas roller?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'cortinas roller',
          groundedSummary: 'Urucortinas ofrece cortinas roller screen y blackout.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Catálogo',
              excerpt: 'Urucortinas ofrece cortinas roller screen y blackout.',
              sequence: 0,
              score: 4,
            },
          ],
        },
      }),
    ).resolves.toBe('Tenemos cortinas roller screen y blackout.');
  });

  it('keeps broad product openings focused on the asked product instead of spilling extra details', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'tienen cortinas roller?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'tienen cortinas roller?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'cortinas roller',
          groundedSummary:
            'Sí, trabajamos con cortinas roller y ofrecemos una garantía habitual de 2 años en estas líneas, incluyendo trabajos de motorización. Para rollers anchos, a veces es conveniente dividir la cortina en dos tramos.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Sí, trabajamos con cortinas roller y ofrecemos una garantía habitual de 2 años en estas líneas, incluyendo trabajos de motorización. Para rollers anchos, a veces es conveniente dividir la cortina en dos tramos.',
              sequence: 0,
              score: 9,
              supportSummary: {
                topic: 'CORTINAS ROLLER',
                supportedAxes: ['product_types'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'product_types',
                    layer: 'factual',
                    values: ['Roller Screen', 'Roller Blackout', 'Roller Doble'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'CORTINAS ROLLER',
                      normalizedValue: 'cortinas roller',
                    },
                    appliesTo: [],
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toBe(
      'Sí, trabajamos con cortinas roller, incluyendo screen, blackout y doble.',
    );
  });

  it('prefers richer structured factual summaries over a narrower grounded summary', async () => {
    const response = await service.resolve({
        locale: 'es',
        userMessage: 'Que medios de pago aceptan?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'Que medios de pago aceptan?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Que medios de pago aceptan?',
          groundedSummary: 'Medios de pago (PRESUPUESTO, PAGOS Y CONFIRMACION): Mercado Pago',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                '- transferencia bancaria - efectivo - Mercado Pago - tarjetas',
              sequence: 0,
              score: 6,
              supportSummary: {
                topic: '3. PRESUPUESTO, PAGOS Y CONFIRMACION / Medios de pago',
                supportedAxes: ['payment_methods'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'payment_methods',
                    layer: 'factual',
                    values: ['transferencia bancaria'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PRESUPUESTO, PAGOS Y CONFIRMACION',
                      normalizedValue: 'presupuesto pagos y confirmacion',
                    },
                  },
                  {
                    axis: 'payment_methods',
                    layer: 'factual',
                    values: ['efectivo'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PRESUPUESTO, PAGOS Y CONFIRMACION',
                      normalizedValue: 'presupuesto pagos y confirmacion',
                    },
                  },
                  {
                    axis: 'payment_methods',
                    layer: 'factual',
                    values: ['Mercado Pago'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PRESUPUESTO, PAGOS Y CONFIRMACION',
                      normalizedValue: 'presupuesto pagos y confirmacion',
                    },
                  },
                  {
                    axis: 'payment_methods',
                    layer: 'factual',
                    values: ['tarjetas'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PRESUPUESTO, PAGOS Y CONFIRMACION',
                      normalizedValue: 'presupuesto pagos y confirmacion',
                    },
                  },
                ],
              },
            },
          ],
        },
      });

    expect(response).toContain('Medios de pago (PRESUPUESTO, PAGOS Y CONFIRMACION):');
    expect(response).toContain('transferencia bancaria');
    expect(response).toContain('efectivo');
    expect(response).toContain('Mercado Pago');
    expect(response).toContain('tarjetas');
  });

  it('keeps the response anchored to the active family instead of mixing sibling aluminum topics', async () => {
    const response = await service.resolve({
        locale: 'es',
        userMessage: 'Trabajan aberturas en aluminio? Que lineas tienen?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.93,
          entities: {
            rawMessage: 'Trabajan aberturas en aluminio? Que lineas tienen?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'aberturas en aluminio lineas',
          groundedSummary:
            'Trabajamos aberturas en aluminio tanto en líneas estándar como en líneas de alta prestación.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: ['specific_variants'],
            supportedDetailTypes: ['specific_variants'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Trabajamos aberturas en aluminio tanto en líneas estándar como en líneas de alta prestación.',
              sequence: 0,
              score: 8,
              supportSummary: {
                topic: '12. ABERTURAS EN ALUMINIO',
                supportedAxes: ['specific_variants'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'specific_variants',
                    layer: 'factual',
                    values: ['líneas estándar', 'líneas de alta prestación'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'ABERTURAS EN ALUMINIO',
                      normalizedValue: 'aberturas en aluminio',
                    },
                  },
                ],
              },
            },
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'También ofrecemos persianas o cortinas de enrollar en aluminio, con varios colores disponibles.',
              sequence: 1,
              score: 7,
              supportSummary: {
                topic: '7.2. PERSIANA O CORTINA DE ENROLLAR EN ALUMINIO',
                supportedAxes: ['color_options'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'color_options',
                    layer: 'factual',
                    values: ['blanco', 'negro', 'gris'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PERSIANA O CORTINA DE ENROLLAR',
                      normalizedValue: 'persiana o cortina de enrollar',
                    },
                    appliesTo: [
                      {
                        axis: 'material',
                        value: 'aluminio',
                        normalizedValue: 'aluminio',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      });

    expect(response).toContain('aberturas en aluminio');
    expect(response).toContain('líneas estándar');
    expect(response).toContain('líneas de alta prestación');
    expect(response).not.toMatch(/persianas|cortinas de enrollar|blanco|negro|gris/i);
  });

  it('prefers a richer excerpt over a low-signal structural summary', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'Trabajan aberturas en aluminio? Que lineas tienen?',
      intent: 'GENERAL_CONVERSATION',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.93,
        entities: {
          rawMessage: 'Trabajan aberturas en aluminio? Que lineas tienen?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'Trabajan aberturas en aluminio? Que lineas tienen?',
        groundedSummary: 'ALUMINIO ALUMINIO',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'explicit',
          exactnessRequested: false,
          requestedDetailTypes: [],
          supportedDetailTypes: [],
          partialDetailTypes: [],
          unsupportedDetailTypes: [],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'Trabajamos aberturas en aluminio tanto en líneas estándar como en líneas de alta prestación.',
            sequence: 0,
            score: 10,
            supportSummary: {
              topic: '12. ABERTURAS EN ALUMINIO',
              supportedAxes: ['materials'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'materials',
                  layer: 'factual',
                  values: ['ALUMINIO'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'ABERTURAS',
                    normalizedValue: 'aberturas',
                  },
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'ALUMINIO',
                      normalizedValue: 'aluminio',
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).toBe(
      'Trabajamos aberturas en aluminio tanto en líneas estándar como en líneas de alta prestación.',
    );
  });

  it('prefers a narrative overview excerpt for broad family questions over structural summaries', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'Tienen cortinas de enrollar?',
      intent: 'GENERAL_CONVERSATION',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.92,
        entities: {
          rawMessage: 'Tienen cortinas de enrollar?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'cortinas de enrollar',
        groundedSummary:
          'materiales: PVC, aluminio; accionamiento: manuales, motorizadas',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'explicit',
          exactnessRequested: false,
          requestedDetailTypes: [],
          supportedDetailTypes: [],
          partialDetailTypes: [],
          unsupportedDetailTypes: [],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'Sí, trabajamos cortinas de enrollar en PVC y aluminio, con opciones manuales o motorizadas.',
            sequence: 0,
            score: 9,
            supportSummary: {
              topic: 'CORTINAS DE ENROLLAR',
              supportedAxes: ['materials', 'operation_modes'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'materials',
                  layer: 'factual',
                  values: ['PVC', 'aluminio'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS DE ENROLLAR',
                    normalizedValue: 'cortinas de enrollar',
                  },
                  appliesTo: [],
                },
                {
                  axis: 'operation_modes',
                  layer: 'factual',
                  values: ['manuales', 'motorizadas'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS DE ENROLLAR',
                    normalizedValue: 'cortinas de enrollar',
                  },
                  appliesTo: [],
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).toBe(
      'Sí, trabajamos con cortinas de enrollar en PVC y aluminio, con opciones manuales o motorizadas.',
    );
  });

  it('falls back to a short subject availability answer for broad family questions when only lateral details are matched', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'Tienen cortinas roller?',
      intent: 'GENERAL_CONVERSATION',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.92,
        entities: {
          rawMessage: 'Tienen cortinas roller?',
          productQuery: 'cortinas roller',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'cortinas roller',
        groundedSummary:
          'En distintas lineas de aluminio, roller y trabajos de motorizacion trabajamos habitualmente con 2 años.',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'explicit',
          exactnessRequested: false,
          requestedDetailTypes: [],
          supportedDetailTypes: [],
          partialDetailTypes: [],
          unsupportedDetailTypes: [],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'En distintas lineas de aluminio, roller y trabajos de motorizacion trabajamos habitualmente con 2 años.',
            sequence: 0,
            score: 9,
            supportSummary: {
              topic: '5. GARANTIAS',
              supportedAxes: ['guarantee'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'guarantee',
                  layer: 'factual',
                  values: ['2 años'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'ROLLER',
                    normalizedValue: 'roller',
                  },
                  appliesTo: [],
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).toBe('Sí, trabajamos con cortinas roller.');
  });

  it('answers supported availability questions for explicit product types with a short subject availability response', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'tienen roller blackout?',
      intent: 'GET_PRODUCT',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.95,
        entities: {
          rawMessage: 'tienen roller blackout?',
          productQuery: 'roller blackout',
          requestSummary: 'Consulta sobre disponibilidad de roller blackout',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre disponibilidad de roller blackout',
        groundedSummary:
          'En una misma instalación una tela screen, una tela blackout Roller Blackout',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'explicit',
          evidenceTier: 'typed_claim',
          absenceReason: null,
          exactnessRequested: false,
          requestedDetailTypes: ['availability'],
          supportedDetailTypes: ['availability'],
          partialDetailTypes: [],
          unsupportedDetailTypes: [],
          requiredUnspecifiedDetailTypes: [],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'La roller blackout está pensada para reducir fuertemente el paso de la luz y dar mayor privacidad.',
            sequence: 20,
            score: 18,
            supportSummary: {
              topic: '6.1. CORTINAS ROLLER / Roller Blackout',
              supportedAxes: ['product_types'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'product_types',
                  layer: 'factual',
                  values: ['Roller Blackout'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS ROLLER',
                    normalizedValue: 'cortinas roller',
                  },
                  appliesTo: [],
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).toBe('Sí, trabajamos con roller blackout.');
  });

  it('returns an explicit out-of-domain negative for unsupported concrete availability subjects', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'Hola venden camas de 1 plaza?',
      intent: 'GET_PRODUCT',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.95,
        entities: {
          rawMessage: 'Hola venden camas de 1 plaza?',
          productQuery: 'camas de 1 plaza',
          requestSummary: 'Consulta sobre disponibilidad de camas de 1 plaza',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre disponibilidad de camas de 1 plaza',
        groundedSummary:
          'Confirmamos el producto, pedimos medidas aproximadas, pedimos cantidad, pedimos variante o configuración si aplica',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'unavailable',
          evidenceTier: 'typed_claim',
          absenceReason: 'document_gap',
          exactnessRequested: false,
          requestedDetailTypes: ['availability'],
          supportedDetailTypes: [],
          partialDetailTypes: [],
          unsupportedDetailTypes: ['availability'],
          requiredUnspecifiedDetailTypes: ['availability'],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'Confirmamos el producto, pedimos medidas aproximadas, pedimos cantidad, pedimos variante o configuración si aplica',
            sequence: 0,
            score: 7,
            supportSummary: {
              topic: 'Si la consulta pasa a presupuesto',
              supportedAxes: ['quote_transition'],
              unspecifiedAxes: [],
            },
          },
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt: 'Roller blackout, roller doble, trasluz y tela liviana.',
            sequence: 1,
            score: 6,
            supportSummary: {
              topic: 'CORTINAS TRADICIONALES',
              supportedAxes: ['product_types'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'product_types',
                  layer: 'factual',
                  values: ['velo', 'trasluz', 'blackout', 'tela liviana', 'doble capa'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS TRADICIONALES',
                    normalizedValue: 'cortinas tradicionales',
                  },
                  appliesTo: [],
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).toBe('No, no trabajamos con camas de 1 plaza.');
  });

  it('does not answer a variants question with operational guidance when the document lacks factual variant support', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'en cortinas roller que opciones tiene?',
      intent: 'GENERAL_CONVERSATION',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.85,
        entities: {
          rawMessage: 'en cortinas roller que opciones tiene?',
          productQuery: 'cortinas roller',
          requestSummary: 'consulta sobre opciones disponibles de cortinas roller',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      conversationState: {
        lane: 'document_exploration',
        approvedFacts: {
          subjectSummary: 'cortinas roller',
          topicSummary: 'cortinas roller',
        },
      } as any,
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'cortinas roller. opciones',
        groundedSummary:
          'Para roller y otras cortinas interiores conviene mantener una atencion mas consultiva: mostrar diferencia entre opciones, ofrecer muestrario cuando hace falta y rectificar medidas antes de cerrar el trabajo.',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'partial',
          exactnessRequested: false,
          requestedDetailTypes: ['specific_variants'],
          supportedDetailTypes: [],
          partialDetailTypes: ['specific_variants'],
          unsupportedDetailTypes: [],
          requiredUnspecifiedDetailTypes: ['specific_variants'],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'Para roller y otras cortinas interiores conviene mantener una atencion mas consultiva: mostrar diferencia entre opciones, ofrecer muestrario cuando hace falta y rectificar medidas antes de cerrar el trabajo.',
            sequence: 0,
            score: 8,
            supportSummary: {
              topic: '8. ROLLER Y CORTINAS INTERIORES - CRITERIOS DE ATENCION',
              supportedAxes: [],
              unspecifiedAxes: [],
            },
          },
        ],
      },
    });

    expect(response).toBe(
      'En cortinas roller, por ahora no tengo confirmación sobre las variantes exactas.',
    );
  });

  it('does not mix nearby families when a shared token like aluminio appears in another subject', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'tienen cortinas de enrollar en aluminio?',
      intent: 'GENERAL_CONVERSATION',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.92,
        entities: {
          rawMessage: 'tienen cortinas de enrollar en aluminio?',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'cortinas de enrollar aluminio',
        groundedSummary:
          'materiales (CORTINAS DE ENROLLAR - CRITERIOS DE ATENCION): Aluminio, PVC; tipos (ABERTURAS EN ALUMINIO - CRITERIOS DE ATENCION): DVH',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'explicit',
          exactnessRequested: false,
          requestedDetailTypes: [],
          supportedDetailTypes: [],
          partialDetailTypes: [],
          unsupportedDetailTypes: [],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Guía',
            excerpt:
              'En cortinas de enrollar la comparación entre PVC y aluminio es una consulta muy frecuente.',
            sequence: 16,
            score: 9,
            supportSummary: {
              topic: '7. CORTINAS DE ENROLLAR - CRITERIOS DE ATENCION / Aluminio',
              supportedAxes: ['materials'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'materials',
                  layer: 'factual',
                  values: ['Aluminio'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS DE ENROLLAR - CRITERIOS DE ATENCION',
                    normalizedValue: 'cortinas de enrollar criterios de atencion',
                  },
                  appliesTo: [],
                },
              ],
            },
          },
          {
            documentId: 'doc-1',
            title: 'Guía',
            excerpt: 'Cuando el cliente prioriza aislamiento térmico, conviene orientar hacia DVH.',
            sequence: 9,
            score: 6,
            supportSummary: {
              topic: '6. ABERTURAS EN ALUMINIO - CRITERIOS DE ATENCION / DVH',
              supportedAxes: ['product_types'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'product_types',
                  layer: 'factual',
                  values: ['DVH'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'ABERTURAS EN ALUMINIO - CRITERIOS DE ATENCION',
                    normalizedValue: 'aberturas en aluminio criterios de atencion',
                  },
                  appliesTo: [],
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).toBe('Sí, tenemos cortinas de enrollar en aluminio.');
    expect(response).not.toContain('DVH');
    expect(response).not.toContain('ABERTURAS');
  });

  it('keeps combined document plus booking answers concise when the document does not specify the requested detail', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'Según el documento, ¿cubren cambio de cadena? Si sí, agendame una visita para mañana a las 11.',
        intent: 'CREATE_BOOKING',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        },
        interpretation: {
          language: 'es',
          confidence: 0.94,
          entities: {
            rawMessage:
              'Según el documento, ¿cubren cambio de cadena? Si sí, agendame una visita para mañana a las 11.',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'create_booking',
          validatedInputSummary: {
            requestedDateIso: '2026-04-05T11:00:00.000Z',
          },
          resultSummary: {
            bookingId: 'bk_12345678',
            scheduledFor: '2026-04-05T11:00:00.000Z',
            status: 'confirmed',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['bookingId', 'scheduledFor', 'status'],
        approvedDocumentIds: [],
        documentContext: {
          source: 'document_origin',
          query: 'cubren cambio de cadena',
          groundedSummary: '',
          responseMode: 'combined_execution',
          grounding: {
            supportLevel: 'unavailable',
            exactnessRequested: false,
            requestedDetailTypes: ['coverage_support'],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: ['coverage_support'],
          },
          matches: [],
        },
      }),
    ).resolves.toBe(
      'Por ahora no tengo confirmación sobre si está cubierto. La reserva fue confirmada para 2026-04-05T11:00:00.000Z.',
    );
  });

  it('returns a short contextual acknowledgment for close_turn responses', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Gracias por la ayuda',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'close_turn',
        decision: {
          domain: 'core',
          action: 'close_turn',
          reasonCode: 'contextual_close_acknowledged',
          missingFields: [],
          responseTemplateKey: 'core.close_turn',
        },
        interpretation: {
          language: 'es',
          confidence: 0.82,
          entities: {
            rawMessage: 'Gracias por la ayuda',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe(
      'Gracias por escribir. Quedamos a disposición por cualquier otra duda.',
    );
  });

  it('uses a governed natural unavailable response when approved knowledge does not support the question', async () => {
    await expect(
      service.resolve({
        locale: 'en',
        userMessage: 'What does the document say about chain replacement coverage?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'general_conversation',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'en',
          confidence: 0.78,
          entities: {
            rawMessage: 'What does the document say about chain replacement coverage?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
        documentContext: {
          source: 'document_origin',
          query: 'chain replacement coverage',
          groundedSummary: '',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'unavailable',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [],
        },
      }),
    ).resolves.toBe("I don't have a clear confirmation on that right now.");
  });

  it('uses a fluid detail-specific unavailable response when the unsupported axis is known', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: '¿Qué colores tienen las blackout?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.82,
          entities: {
            rawMessage: '¿Qué colores tienen las blackout?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
        documentContext: {
          source: 'document_origin',
          query: 'colores blackout',
          groundedSummary: '',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'unavailable',
            exactnessRequested: false,
            requestedDetailTypes: ['color_options'],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: ['color_options'],
          },
          matches: [],
        },
      }),
    ).resolves.toBe(
      'Por ahora no tengo confirmación sobre los colores exactos.',
    );
  });

  it('uses a warmer basic response without becoming verbose', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Hola',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'general_conversation',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.88,
          entities: {
            rawMessage: 'Hola',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe('Hola, contame en qué te puedo ayudar.');
  });

  it('keeps combined document plus execution fallback concise when the grounded summary is long', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'Según el documento, ¿cubren cambio de cadena? Si sí, agendame una visita.',
        intent: 'CREATE_BOOKING',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        },
        interpretation: {
          language: 'es',
          confidence: 0.94,
          entities: {
            rawMessage:
              'Según el documento, ¿cubren cambio de cadena? Si sí, agendame una visita.',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'create_booking',
          validatedInputSummary: {
            requestedDateIso: '2026-04-05T11:00:00.000Z',
          },
          resultSummary: {
            bookingId: 'bk_999',
            scheduledFor: '2026-04-05T11:00:00.000Z',
            status: 'confirmed',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['bookingId', 'scheduledFor', 'status'],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'cambio de cadena roller',
          groundedSummary:
            'El documento indica que el cambio de cadena de cortinas roller está cubierto dentro del servicio estándar. También describe características generales del producto y recomendaciones de mantenimiento complementarias para distintos ambientes.',
          responseMode: 'combined_execution',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Cobertura Roller',
              excerpt:
                'El cambio de cadena está cubierto dentro del servicio estándar. También describe características generales.',
              sequence: 0,
              score: 4.4,
            },
          ],
        },
      }),
    ).resolves.toBe(
      'El cambio de cadena de cortinas roller está cubierto dentro del servicio estándar. La reserva fue confirmada para 2026-04-05T11:00:00.000Z.',
    );
  });

  it('adds a contextual greeting and multiline layout on the first substantive document reply', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Necesito información sobre cortinas roller',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.91,
          entities: {
            rawMessage: 'Necesito información sobre cortinas roller',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'cortinas roller',
          groundedSummary: 'Sí, tenemos cortinas roller.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Catálogo',
              excerpt: 'Sí, tenemos cortinas roller.',
              sequence: 0,
              score: 4.1,
            },
          ],
        },
        responseStyle: {
          preferBrief: true,
          incrementalFollowUp: false,
          groundedKnowledgeOnly: false,
          includeInitialGreeting: true,
          preferMultiline: true,
          hasPriorConversation: false,
        },
      }),
    ).resolves.toBe(
      'Hola, gracias por contactarnos.\n\nSí, tenemos cortinas roller.',
    );
  });

  it('prefers explicit scoped visit-cost facts over adjacent partial travel-cost caveats', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'me encuentro en montevideo',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.94,
          entities: {
            rawMessage: 'me encuentro en montevideo',
            requestSummary: 'El usuario indica que se encuentra en Montevideo.',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'El usuario indica que se encuentra en Montevideo.',
          groundedSummary: 'sin costo',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Fuera de Montevideo puede corresponder costo de traslado.',
              sequence: 0,
              score: 4.8,
              supportSummary: {
                topic: '2. FORMA DE TRABAJO / La forma habitual de avanzar es',
                supportedAxes: [
                  'service_offers',
                  'commercial_visit_cost',
                  'travel_cost_responsibility',
                ],
                axisSummaries: [
                  {
                    axis: 'commercial_visit_cost',
                    layer: 'factual',
                    values: ['sin costo'],
                    subject: {
                      axis: 'section_topic',
                      value: 'FORMA DE TRABAJO',
                      normalizedValue: 'forma de trabajo',
                    },
                    appliesTo: [
                      {
                        axis: 'location',
                        value: 'Montevideo',
                        normalizedValue: 'montevideo',
                      },
                    ],
                    supportClass: 'explicit_fact',
                    extractionScope: 'tenant_only',
                  },
                  {
                    axis: 'travel_cost_responsibility',
                    layer: 'factual',
                    values: ['puede corresponder costo de traslado'],
                    subject: {
                      axis: 'section_topic',
                      value: 'FORMA DE TRABAJO',
                      normalizedValue: 'forma de trabajo',
                    },
                    appliesTo: [
                      {
                        axis: 'location',
                        value: 'Montevideo',
                        normalizedValue: 'montevideo',
                      },
                    ],
                    supportClass: 'partial_fact',
                    extractionScope: 'tenant_only',
                  },
                ],
                unspecifiedAxes: [],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(expect.not.stringMatching(/traslado/i));
  });

  it('renders scoped color answers in customer-facing prose instead of structural labels', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'Perfecto entonces en PVC solo blanco y en aluminio que colores tienen?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage:
              'Perfecto entonces en PVC solo blanco y en aluminio que colores tienen?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query:
            'Consulta sobre colores disponibles para cortinas enrollar de aluminio y PVC',
          groundedSummary:
            'En PVC el color disponible es blanco. En aluminio, los colores disponibles son blanco, negro, marron, color madera, gris y verde.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: ['color_options'],
            supportedDetailTypes: ['color_options'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                '- color blanco\n- variedad de colores(blanco negro marron color madera gris verde)',
              sequence: 0,
              score: 8.1,
              supportSummary: {
                topic: '7. CORTINAS DE ENROLLAR',
                supportedAxes: ['color_options'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'color_options',
                    layer: 'factual',
                    values: ['blanco'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PERSIANA O CORTINA DE ENROLLAR',
                      normalizedValue: 'persiana o cortina de enrollar',
                    },
                    appliesTo: [
                      { axis: 'material', value: 'PVC', normalizedValue: 'pvc' },
                    ],
                  },
                  {
                    axis: 'color_options',
                    layer: 'factual',
                    values: ['blanco', 'negro', 'marron', 'color madera', 'gris', 'verde'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PERSIANA O CORTINA DE ENROLLAR',
                      normalizedValue: 'persiana o cortina de enrollar',
                    },
                    appliesTo: [
                      {
                        axis: 'material',
                        value: 'ALUMINIO',
                        normalizedValue: 'aluminio',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'En PVC el color disponible es blanco. En aluminio, los colores disponibles son blanco, negro, marron, color madera, gris y verde.',
    );
  });

  it('renders scoped warranty answers in customer-facing prose', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'que garantia tiene el producto?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'que garantia tiene el producto?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre garantía del producto',
          groundedSummary: '2 años',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: ['warranty'],
            supportedDetailTypes: ['warranty'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt: '- 2 años en PVC\n- 2 años en aluminio',
              sequence: 0,
              score: 7.5,
              supportSummary: {
                topic: 'GARANTIA',
                supportedAxes: ['warranty_terms'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'warranty_terms',
                    layer: 'factual',
                    values: ['2 años'],
                    supportClass: 'explicit_fact',
                    appliesTo: [
                      { axis: 'material', value: 'PVC', normalizedValue: 'pvc' },
                    ],
                  },
                  {
                    axis: 'warranty_terms',
                    layer: 'factual',
                    values: ['2 años'],
                    supportClass: 'explicit_fact',
                    appliesTo: [
                      {
                        axis: 'material',
                        value: 'ALUMINIO',
                        normalizedValue: 'aluminio',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'La garantía de referencia es de 2 años tanto en PVC como en aluminio.',
    );
  });

  it('renders payment terms in customer-facing prose and preserves a cautious warranty clause when mixed with an unsupported warranty request', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'que formas de pago aceptan? tiene garantia?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'que formas de pago aceptan? tiene garantia?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre formas de pago y garantía',
          groundedSummary:
            'Condiciones de pago (cuotas) (payment method Mercado Pago): 12',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'partial',
            evidenceTier: 'typed_claim',
            absenceReason: 'extraction_uncertain',
            exactnessRequested: false,
            requestedDetailTypes: ['payment_terms', 'warranty'],
            supportedDetailTypes: ['payment_terms'],
            partialDetailTypes: [],
            unsupportedDetailTypes: ['warranty'],
            requiredUnspecifiedDetailTypes: ['warranty'],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Mercado Pago ofrece hasta 12 cuotas y tarjetas como VISA, Mastercard, OCA y Creditel.',
              sequence: 0,
              score: 9.3,
              supportSummary: {
                topic: 'PAGOS',
                supportedAxes: ['payment_terms', 'payment_methods', 'installment_count'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'payment_methods',
                    layer: 'factual',
                    values: [
                      'transferencia bancaria',
                      'efectivo',
                      'Mercado Pago',
                      'tarjetas',
                    ],
                    supportClass: 'explicit_fact',
                  },
                  {
                    axis: 'payment_terms',
                    facet: 'installment_count',
                    layer: 'factual',
                    values: ['12'],
                    supportClass: 'explicit_fact',
                    appliesTo: [
                      {
                        axis: 'payment_method',
                        value: 'Mercado Pago',
                        normalizedValue: 'mercado pago',
                      },
                    ],
                  },
                  {
                    axis: 'payment_terms',
                    facet: 'card_brands',
                    layer: 'factual',
                    values: ['VISA', 'Mastercard', 'OCA', 'Creditel'],
                    supportClass: 'explicit_fact',
                    appliesTo: [
                      {
                        axis: 'payment_method',
                        value: 'Mercado Pago',
                        normalizedValue: 'mercado pago',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Aceptamos transferencia bancaria, efectivo, Mercado Pago y tarjetas. Con Mercado Pago se puede pagar hasta en 12 cuotas y se aceptan VISA, Mastercard, OCA y Creditel. Por ahora no tengo una confirmación suficientemente clara sobre la garantía.',
    );
  });

  it('composes supported service capability with a scoped unsupported compatibility clause', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'y hacen instalacion de aberturas con albañileria?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.9,
          entities: {
            rawMessage: 'y hacen instalacion de aberturas con albañileria?',
            productQuery: 'instalacion de aberturas con albañileria',
            requestSummary: 'Consulta sobre instalación de aberturas con albañilería',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre instalación de aberturas con albañilería',
          groundedSummary: 'toma de medidas, instalacion',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'partial',
            evidenceTier: 'typed_claim',
            absenceReason: 'document_gap',
            exactnessRequested: false,
            requestedDetailTypes: ['service_capability', 'feature_support'],
            supportedDetailTypes: ['service_capability'],
            partialDetailTypes: [],
            unsupportedDetailTypes: ['feature_support'],
            requiredUnspecifiedDetailTypes: ['feature_support'],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'La mano de obra de aberturas puede cotizarse por separado o quedar sujeta a confirmación según el relevamiento en obra.',
              sequence: 0,
              score: 8.4,
              supportSummary: {
                topic: '12. ABERTURAS EN ALUMINIO / Instalación',
                supportedAxes: ['service_offers'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: ['instalacion'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'ABERTURAS',
                      normalizedValue: 'aberturas',
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Sí, realizamos instalación para aberturas. En aberturas, por ahora no tengo confirmación sobre la compatibilidad exacta.',
    );
  });

  it('renders purchase-channel answers in customer-facing prose when local presence facts exist', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'tienen local comercial?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'tienen local comercial?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre local comercial y modalidad de atención',
          groundedSummary:
            'No contamos con local comercial. Nuestra atención es principalmente online.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['purchase_channel'],
            supportedDetailTypes: ['purchase_channel'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'No contamos con local comercial. Nuestra atención es principalmente online. Podemos coordinar visitas a domicilio para mostrarte el producto.',
              sequence: 0,
              score: 8.8,
              supportSummary: {
                topic: 'INFORMACION GENERAL',
                supportedAxes: [
                  'commercial_presence',
                  'service_offers',
                  'coverage_locations',
                ],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'commercial_presence',
                    layer: 'factual',
                    values: ['sin local comercial', 'atencion online'],
                    supportClass: 'explicit_fact',
                  },
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: ['visita a domicilio', 'muestras'],
                    supportClass: 'explicit_fact',
                  },
                  {
                    axis: 'coverage_locations',
                    layer: 'factual',
                    values: ['Montevideo'],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'No contamos con local comercial. Trabajamos principalmente de forma online. Si estás en Montevideo, podemos coordinar una visita a domicilio para mostrarte el producto.',
    );
  });

  it('renders service capability answers from service offers in customer-facing prose', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'toman medidas a domicilio?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'toman medidas a domicilio?',
            productQuery: 'cortina de enrollar',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre toma de medidas a domicilio',
          groundedSummary:
            'Sí, podemos coordinar una visita a domicilio para tomar medidas.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['service_capability'],
            supportedDetailTypes: ['service_capability'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Sí, podemos coordinar una visita a domicilio para tomar medidas.',
              sequence: 0,
              score: 8.2,
              supportSummary: {
                topic: 'VISITA PREVIA',
                supportedAxes: ['service_offers'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: ['visita a domicilio', 'toma de medidas'],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Sí, podemos coordinar una visita a domicilio para tomar medidas.',
    );
  });

  it('renders automation and maintenance capabilities as an affirmative service summary', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'puedo automatizar mis cortinas actuales y hacer mantenimiento si algo falla?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage:
              'puedo automatizar mis cortinas actuales y hacer mantenimiento si algo falla?',
            productQuery: 'cortinas actuales',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre automatización y mantenimiento de cortinas actuales',
          groundedSummary:
            'Sí, realizamos automatización, motorización y mantenimiento.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['service_capability'],
            supportedDetailTypes: ['service_capability'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Ofrecemos automatización para cortinas y persianas, además de mantenimiento y reparación.',
              sequence: 0,
              score: 8.9,
              supportSummary: {
                topic: 'AUTOMATIZACION Y MANTENIMIENTO',
                supportedAxes: ['service_offers'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: ['automatizacion', 'motorizacion', 'mantenimiento'],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Sí, realizamos automatización, motorización y mantenimiento.',
    );
  });

  it('combines supported service capability with recommendation-oriented clarification in noisy mixed turns', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'hola, estoy viendo opciones porque se me rompio una persiana y ademas quiero algo mas moderno, ustedes hacen eso?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage:
              'hola, estoy viendo opciones porque se me rompio una persiana y ademas quiero algo mas moderno, ustedes hacen eso?',
            productQuery: 'persiana moderna',
            requestSummary: 'Consulta sobre reparación y opciones modernas de persianas',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre reparación y opciones modernas de persianas',
          groundedSummary:
            'Sí, realizamos reparación de cortinas y persianas, además de mantenimiento general.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'partial',
            evidenceTier: 'typed_claim',
            absenceReason: 'document_gap',
            exactnessRequested: false,
            requestedDetailTypes: [
              'service_capability',
              'recommendation',
              'specific_variants',
            ],
            supportedDetailTypes: ['service_capability'],
            partialDetailTypes: [],
            unsupportedDetailTypes: ['recommendation', 'specific_variants'],
            requiredUnspecifiedDetailTypes: ['recommendation', 'specific_variants'],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Realizamos reparación de cortinas y persianas, además de mantenimiento general.',
              sequence: 0,
              score: 8.4,
              supportSummary: {
                topic: '13. SERVICIOS / Reparación y mantenimiento',
                supportedAxes: ['service_offers'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: ['reparacion', 'mantenimiento'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'SERVICIOS',
                      normalizedValue: 'servicios',
                    },
                  },
                ],
              },
            },
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Combinamos venta, instalación, mantenimiento, reparación y trabajos a medida.',
              sequence: 1,
              score: 7.1,
              supportSummary: {
                topic: '1. PERFIL COMERCIAL DE URUCORTINAS',
                supportedAxes: ['commercial_presence', 'service_offers'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: [
                      'visita a domicilio',
                      'toma de medidas',
                      'instalacion',
                      'automatizacion',
                      'motorizacion',
                      'reparacion',
                      'mantenimiento',
                    ],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PERFIL COMERCIAL DE URUCORTINAS',
                      normalizedValue: 'perfil comercial de urucortinas',
                    },
                  },
                  {
                    axis: 'commercial_presence',
                    layer: 'factual',
                    values: ['sin local comercial'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'PERFIL COMERCIAL DE URUCORTINAS',
                      normalizedValue: 'perfil comercial de urucortinas',
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Sí, realizamos reparación. Si además estás evaluando una alternativa más moderna o conveniente, decime qué producto o línea estás viendo y te oriento.',
    );
  });

  it('responds with an explicit negative when the subject is concrete and outside the supported domain', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'venden muebles o hacen trabajos electricos?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'venden muebles o hacen trabajos electricos?',
            productQuery: 'muebles o trabajos eléctricos',
            requestSummary:
              'Consulta sobre venta de muebles o realización de trabajos eléctricos',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre venta de muebles o realización de trabajos eléctricos',
          groundedSummary:
            'Combinamos venta, instalación, mantenimiento, reparación y trabajos a medida.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'unavailable',
            evidenceTier: 'none',
            absenceReason: 'document_gap',
            exactnessRequested: false,
            requestedDetailTypes: [],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Combinamos venta, instalación, mantenimiento, reparación y trabajos a medida.',
              sequence: 0,
              score: 2.1,
              supportSummary: {
                topic: '1. PERFIL COMERCIAL DE URUCORTINAS',
                supportedAxes: ['service_offers'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: ['instalacion', 'mantenimiento', 'reparacion'],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'No, no trabajamos con muebles ni con trabajos eléctricos.',
    );
  });

  it('does not emit an out-of-domain negative when the user clarifies ventanas and the evidence is anchored on aberturas', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage: 'es para unas ventanas del living',
      intent: 'CREATE_QUOTE',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'general_conversation',
        missingFields: ['quote_scope'],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.92,
        entities: {
          rawMessage: 'es para unas ventanas del living',
          productQuery: 'ventanas',
          requestSummary: 'Solicitud de presupuesto para ventanas del living',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'Solicitud de presupuesto para ventanas del living',
        groundedSummary:
          'Confirmamos el producto, pedimos medidas aproximadas y el tipo de abertura.',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'unavailable',
          evidenceTier: 'typed_claim',
          absenceReason: 'document_gap',
          exactnessRequested: false,
          requestedDetailTypes: ['quote_requirements'],
          supportedDetailTypes: [],
          partialDetailTypes: [],
          unsupportedDetailTypes: ['quote_requirements'],
          requiredUnspecifiedDetailTypes: ['quote_requirements'],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'tipo de abertura, ancho y alto aproximado, serie y tipo de vidrio.',
            sequence: 0,
            score: 8.8,
            supportSummary: {
              topic: '12. ABERTURAS EN ALUMINIO / Datos útiles para presupuesto',
              supportedAxes: ['quote_fields'],
              unspecifiedAxes: [],
              metadataNotes: [
                {
                  axis: 'quote_fields',
                  layer: 'workflow',
                  values: [
                    'tipo de abertura',
                    'ancho y alto aproximado',
                    'serie',
                    'tipo de vidrio',
                  ],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'ABERTURAS',
                    normalizedValue: 'aberturas',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).not.toContain('No, no trabajamos');
    expect(response).toMatch(/producto o línea|producto o linea/i);
  });

  it('does not emit an out-of-domain negative when service evidence supports a noisy repair-plus-recommendation turn', async () => {
    const response = await service.resolve({
      locale: 'es',
      userMessage:
        'hola, estoy viendo opciones porque se me rompio una persiana y ademas quiero algo mas moderno, ustedes hacen eso?',
      intent: 'GENERAL_CONVERSATION',
      outcome: 'respond',
      decision: {
        domain: 'core',
        action: 'respond',
        reasonCode: 'document_grounded_exploration',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      },
      interpretation: {
        language: 'es',
        confidence: 0.95,
        entities: {
          rawMessage:
            'hola, estoy viendo opciones porque se me rompio una persiana y ademas quiero algo mas moderno, ustedes hacen eso?',
          productQuery: 'persiana moderna',
          requestSummary: 'Consulta sobre reparación y opciones modernas de persianas',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      },
      execution: {
        status: 'not_applicable',
        toolName: null,
        validatedInputSummary: null,
        resultSummary: null,
        failure: null,
      },
      approvedFactKeys: [],
      approvedResultKeys: [],
      approvedDocumentIds: ['doc-1'],
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre reparación y opciones modernas de persianas',
        groundedSummary:
          'Combinamos venta, instalación, mantenimiento, reparación y trabajos a medida.',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'unavailable',
          evidenceTier: 'typed_claim',
          absenceReason: 'document_gap',
          exactnessRequested: false,
          requestedDetailTypes: ['service_capability', 'recommendation'],
          supportedDetailTypes: [],
          partialDetailTypes: [],
          unsupportedDetailTypes: ['service_capability', 'recommendation'],
          requiredUnspecifiedDetailTypes: ['recommendation'],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'Realizamos reparación de cortinas y persianas, además de mantenimiento general.',
            sequence: 0,
            score: 8.4,
            supportSummary: {
              topic: '13. SERVICIOS / Reparación y mantenimiento',
              supportedAxes: ['service_offers'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'service_offers',
                  layer: 'factual',
                  values: ['reparacion', 'mantenimiento'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'SERVICIOS',
                    normalizedValue: 'servicios',
                  },
                },
              ],
              metadataNotes: [
                {
                  axis: 'comparison_guidance',
                  layer: 'guidance',
                  values: [
                    'Para un recambio más moderno, te orientamos según si buscas una opción más económica o una de mayor durabilidad.',
                  ],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'PERSIANAS Y CORTINAS DE ENROLLAR',
                    normalizedValue: 'persianas y cortinas de enrollar',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(response).not.toContain('No, no trabajamos');
    expect(response).toContain('Sí, realizamos reparación');
    expect(response).toMatch(/producto o línea|producto o linea/i);
  });

  it('asks for product context before answering detail-only material questions', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'que materiales tienen?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.9,
          entities: {
            rawMessage: 'que materiales tienen?',
            requestSummary: 'Consulta sobre materiales disponibles',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'materiales disponibles',
          groundedSummary: 'PVC, aluminio, screen y blackout.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['materials'],
            supportedDetailTypes: ['materials'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt: 'Las cortinas de enrollar se trabajan en PVC y aluminio.',
              sequence: 0,
              score: 7.9,
              supportSummary: {
                topic: 'CORTINAS DE ENROLLAR / Materiales',
                supportedAxes: ['materials'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'materials',
                    layer: 'factual',
                    values: ['PVC', 'aluminio'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'product_family',
                      value: 'cortinas de enrollar',
                      normalizedValue: 'cortinas de enrollar',
                    },
                  },
                ],
              },
            },
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt: 'Las cortinas roller se trabajan en screen y blackout.',
              sequence: 1,
              score: 7.8,
              supportSummary: {
                topic: 'CORTINAS ROLLER / Materiales',
                supportedAxes: ['materials'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'materials',
                    layer: 'factual',
                    values: ['screen', 'blackout'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'product_family',
                      value: 'cortinas roller',
                      normalizedValue: 'cortinas roller',
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Depende del producto o línea. Si me indicás si estás viendo cortinas de enrollar o cortinas roller, te digo los materiales exactos.',
    );
  });

  it('offers a family partition when the same turn mixes multiple product families', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'estoy viendo roller blackout para un dormitorio y tambien aberturas con dvh para otro ambiente, me orientas?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.9,
          entities: {
            rawMessage:
              'estoy viendo roller blackout para un dormitorio y tambien aberturas con dvh para otro ambiente, me orientas?',
            productQuery:
              'roller blackout para un dormitorio y también aberturas con DVH para otro ambiente',
            requestSummary:
              'Consulta sobre roller blackout para dormitorio y aberturas con DVH para otro ambiente',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query:
            'roller blackout para dormitorio y aberturas con dvh para otro ambiente',
          groundedSummary:
            'Roller blackout y aberturas con DVH son opciones válidas según el ambiente.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['recommendation', 'feature_support'],
            supportedDetailTypes: ['recommendation', 'feature_support'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt: 'Roller blackout reduce fuertemente el paso de la luz.',
              sequence: 0,
              score: 8.5,
              supportSummary: {
                topic: 'CORTINAS ROLLER / Roller blackout',
                supportedAxes: ['product_types'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'product_types',
                    layer: 'factual',
                    values: ['roller blackout'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'product_family',
                      value: 'cortinas roller',
                      normalizedValue: 'cortinas roller',
                    },
                  },
                ],
              },
            },
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt: 'Las aberturas Probba y Gala admiten DVH.',
              sequence: 1,
              score: 8.4,
              supportSummary: {
                topic: 'ABERTURAS / DVH',
                supportedAxes: ['feature_support'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'feature_support',
                    layer: 'factual',
                    values: ['DVH'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'product_family',
                      value: 'aberturas',
                      normalizedValue: 'aberturas',
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Sí, te puedo orientar con cortinas roller y aberturas. Si te parece, arrancamos por una primero y después vemos la otra: ¿querés empezar por cortinas roller o por aberturas?',
    );
  });

  it('renders quote requirement answers from quote fields in customer-facing prose', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'que datos necesitan para cotizar?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'que datos necesitan para cotizar?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre datos para presupuesto',
          groundedSummary:
            'Para cotizar necesitamos ancho y alto aproximado, si es instalación nueva o reemplazo, y si prefieres manual o motorizada.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['quote_requirements'],
            supportedDetailTypes: ['quote_requirements'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'ancho y alto aproximado; si es instalación nueva o reemplazo; si prefieres manual o motorizada',
              sequence: 0,
              score: 8.1,
              supportSummary: {
                topic: 'Datos útiles para presupuesto',
                supportedAxes: ['quote_fields'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'quote_fields',
                    layer: 'workflow',
                    values: [
                      'ancho y alto aproximado',
                      'si es instalación nueva o reemplazo',
                      'si prefieres manual o motorizada',
                    ],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Para cotizar necesitamos ancho y alto aproximado, si es instalación nueva o reemplazo, y si prefieres manual o motorizada.',
    );
  });

  it('renders recommendation answers from comparison guidance in customer-facing prose', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'que me recomiendas entre serie 25 probba y gala?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'que me recomiendas entre serie 25 probba y gala?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta comparativa entre Serie 25, Probba y Gala',
          groundedSummary:
            'Serie 25 es una opción más estándar. Probba es una línea intermedia. Gala es una línea más fuerte y de mejor prestación general.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['recommendation'],
            supportedDetailTypes: ['recommendation'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Serie 25 es una opción más estándar. Probba es una línea intermedia. Gala es una línea más fuerte y de mejor prestación general.',
              sequence: 0,
              score: 8.5,
              supportSummary: {
                topic: 'RECOMENDACION ENTRE SERIE 25, PROBBA Y GALA',
                supportedAxes: ['comparison_guidance'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'comparison_guidance',
                    layer: 'guidance',
                    values: [
                      'Serie 25 es una opción más estándar. Probba es una línea intermedia. Gala es una línea más fuerte y de mejor prestación general.',
                    ],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Serie 25 es una opción más estándar. Probba es una línea intermedia. Gala es una línea más fuerte y de mejor prestación general.',
    );
  });

  it('prefers recommendation-oriented guidance over service phrasing when the turn describes usage constraints', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'me interesa algo exterior y de bajo mantenimiento',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.94,
          entities: {
            rawMessage: 'me interesa algo exterior y de bajo mantenimiento',
            productQuery: 'persiana exterior de bajo mantenimiento',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Interés en persiana exterior de bajo mantenimiento',
          groundedSummary:
            'Ofrecemos persianas exteriores que requieren bajo mantenimiento, con servicios de instalación, mantenimiento, reparación y automatización.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['recommendation', 'service_capability'],
            supportedDetailTypes: ['recommendation', 'service_capability'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Las cortinas de enrollar exteriores pueden ser de PVC o aluminio y requieren poco mantenimiento.',
              sequence: 0,
              score: 7.1,
              supportSummary: {
                topic: 'CORTINAS DE ENROLLAR',
                supportedAxes: ['materials', 'product_types'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'materials',
                    layer: 'factual',
                    values: ['PVC', 'ALUMINIO'],
                    supportClass: 'explicit_fact',
                    subject: {
                      axis: 'section_topic',
                      value: 'CORTINAS DE ENROLLAR',
                      normalizedValue: 'cortinas de enrollar',
                    },
                  },
                ],
              },
            },
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Realizamos instalación, mantenimiento, reparación y automatización.',
              sequence: 1,
              score: 6.8,
              supportSummary: {
                topic: 'SERVICIOS',
                supportedAxes: ['service_offers'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'service_offers',
                    layer: 'factual',
                    values: ['instalacion', 'mantenimiento', 'reparacion'],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Para lo que buscas, solemos orientar primero a cortinas de enrollar en PVC y ALUMINIO.',
    );
  });

  it('prefers the most compact comparison guidance when multiple recommendation notes are available', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'me interesa algo exterior y de bajo mantenimiento',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.94,
          entities: {
            rawMessage: 'me interesa algo exterior y de bajo mantenimiento',
            productQuery: 'persiana exterior de bajo mantenimiento',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Interés en persiana exterior de bajo mantenimiento',
          groundedSummary:
            'Para una opción exterior y de bajo mantenimiento, recomendamos persianas o cortinas de enrollar.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            evidenceTier: 'typed_claim',
            absenceReason: null,
            exactnessRequested: false,
            requestedDetailTypes: ['recommendation'],
            supportedDetailTypes: ['recommendation'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Cuando el cliente consulta por persianas viejas de madera o sistemas deteriorados, la orientación comercial más clara es pasar a un recambio por PVC o aluminio según el nivel de prestación que busque.',
              sequence: 0,
              score: 7.1,
              supportSummary: {
                topic: 'Comparación útil',
                supportedAxes: ['comparison_guidance'],
                unspecifiedAxes: [],
                metadataNotes: [
                  {
                    axis: 'comparison_guidance',
                    layer: 'guidance',
                    values: [
                      'Cuando el cliente consulta por persianas viejas de madera o sistemas deteriorados, la orientación comercial más clara es pasar a un recambio por PVC o aluminio según el nivel de prestación que busque. El PVC suele funcionar mejor cuando se busca una opción más económica y práctica. El aluminio suele ser la opción de mayor resistencia, aislamiento y durabilidad.',
                    ],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'PVC es la opción más funcional y económica. Aluminio es la opción de mayor durabilidad, mejor prestación y mejor garantía.',
              sequence: 1,
              score: 6.8,
              supportSummary: {
                topic: 'Comparación útil',
                supportedAxes: ['comparison_guidance'],
                unspecifiedAxes: [],
                metadataNotes: [
                  {
                    axis: 'comparison_guidance',
                    layer: 'guidance',
                    values: [
                      'PVC es la opción más funcional y económica. Aluminio es la opción de mayor durabilidad, mejor prestación y mejor garantía.',
                    ],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'PVC es la opción más funcional y económica. Aluminio es la opción de mayor durabilidad, mejor prestación y mejor garantía.',
    );
  });

  it('turns confirmation policy guidance into a customer-facing follow-up prompt when the exact detail is unconfirmed', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'que textura exacta tienen disponible hoy?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'que textura exacta tienen disponible hoy?',
            productQuery: 'roller blackout',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre textura exacta para roller blackout',
          groundedSummary:
            'Si hace falta una confirmación puntual, se consulta y se detalla a la brevedad.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'partial',
            evidenceTier: 'typed_claim',
            absenceReason: 'document_gap',
            exactnessRequested: true,
            requestedDetailTypes: ['color_options'],
            supportedDetailTypes: [],
            partialDetailTypes: [],
            unsupportedDetailTypes: ['color_options'],
            requiredUnspecifiedDetailTypes: ['color_options'],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Si hace falta una confirmación puntual, se consulta y se detalla a la brevedad: disponibilidad puntual de colores o texturas.',
              sequence: 0,
              score: 7.7,
              supportSummary: {
                topic: 'COMO SOLEMOS AVANZAR UNA CONSULTA',
                supportedAxes: ['confirmation_policy'],
                unspecifiedAxes: ['exact_color_options'],
                metadataNotes: [
                  {
                    axis: 'confirmation_policy',
                    layer: 'guidance',
                    values: ['disponibilidad puntual de colores o texturas'],
                    supportClass: 'partial_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Por ahora no tengo confirmación sobre los colores exactos. Si me indicás qué variante o línea de roller blackout estás buscando, te oriento con las opciones y, si hace falta, te confirmo ese detalle puntual.',
    );
  });

  it('suppresses literal confirmation guidance summaries and uses metadata notes for unsupported availability details', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'que textura exacta tienen disponible hoy?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.85,
          entities: {
            rawMessage: 'que textura exacta tienen disponible hoy?',
            productQuery: 'textura disponible',
            requestSummary: 'Consulta sobre la textura exacta disponible hoy',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre la textura exacta disponible hoy',
          groundedSummary:
            'Si hace falta una confirmación puntual, se comenta que no se tiene esa información en este momento y se consulta y se detalla a la brevedad: disponibilidad puntual de colores o texturas.',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'partial',
            evidenceTier: 'excerpt_only',
            absenceReason: 'extraction_uncertain',
            exactnessRequested: true,
            requestedDetailTypes: ['availability'],
            supportedDetailTypes: [],
            partialDetailTypes: ['availability'],
            unsupportedDetailTypes: [],
            requiredUnspecifiedDetailTypes: ['availability'],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt: '- pedimos variante o configuración si aplica',
              sequence: 122,
              score: 5,
              supportSummary: {
                topic:
                  '14. COMO SOLEMOS AVANZAR UNA CONSULTA / Si la consulta pasa a presupuesto',
                supportedAxes: ['quote_transition'],
                unspecifiedAxes: [],
                metadataNotes: [
                  {
                    axis: 'quote_transition',
                    layer: 'guidance',
                    values: [
                      'confirmamos el producto',
                      'pedimos medidas aproximadas',
                      'pedimos cantidad',
                      'pedimos variante o configuración si aplica',
                    ],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt:
                'Si hace falta una confirmación puntual, se comenta que no se tiene esa información en este momento y se consulta y se detalla a la brevedad: disponibilidad puntual de colores o texturas.',
              sequence: 123,
              score: 2,
              supportSummary: {
                topic:
                  '14. COMO SOLEMOS AVANZAR UNA CONSULTA / Si hace falta una confirmación puntual',
                supportedAxes: ['confirmation_policy'],
                unspecifiedAxes: [],
                metadataNotes: [
                  {
                    axis: 'confirmation_policy',
                    layer: 'guidance',
                    values: [
                      'disponibilidad puntual de colores o texturas',
                      'detalles técnicos especificos',
                    ],
                    supportClass: 'explicit_fact',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual(
      'Por ahora no tengo una confirmación suficientemente clara sobre la disponibilidad exacta. Si me indicás qué producto, variante o línea estás buscando, te oriento con las opciones y, si hace falta, te confirmo ese detalle puntual.',
    );
  });

  it('answers outside-location visit-cost follow-ups with the outside scoped fact instead of the inside one', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'fuera de montevideo la visita tiene costo?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'document_grounded_exploration',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {
            rawMessage: 'fuera de montevideo la visita tiene costo?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'Consulta sobre costo de visita para tomar medidas fuera de Montevideo',
          groundedSummary:
            'Costo de visita (location Montevideo, location relation inside): sin costo',
          responseMode: 'document_exploration',
          grounding: {
            supportLevel: 'explicit',
            exactnessRequested: false,
            requestedDetailTypes: ['pricing'],
            supportedDetailTypes: ['pricing'],
            partialDetailTypes: [],
            unsupportedDetailTypes: [],
          },
          matches: [
            {
              documentId: 'doc-1',
              title: 'Documento Maestro',
              excerpt: 'Fuera de Montevideo puede corresponder costo de traslado.',
              sequence: 0,
              score: 8.4,
              supportSummary: {
                topic: 'FORMA DE TRABAJO',
                supportedAxes: ['commercial_visit_cost', 'travel_cost_responsibility'],
                unspecifiedAxes: [],
                axisSummaries: [
                  {
                    axis: 'commercial_visit_cost',
                    layer: 'factual',
                    values: ['sin costo'],
                    supportClass: 'explicit_fact',
                    appliesTo: [
                      {
                        axis: 'location',
                        value: 'Montevideo',
                        normalizedValue: 'montevideo',
                      },
                      {
                        axis: 'location_relation',
                        value: 'inside',
                        normalizedValue: 'inside',
                      },
                    ],
                  },
                  {
                    axis: 'travel_cost_responsibility',
                    layer: 'factual',
                    values: ['puede corresponder costo de traslado'],
                    supportClass: 'partial_fact',
                    appliesTo: [
                      {
                        axis: 'location',
                        value: 'Montevideo',
                        normalizedValue: 'montevideo',
                      },
                      {
                        axis: 'location_relation',
                        value: 'outside',
                        normalizedValue: 'outside',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    ).resolves.toEqual('Fuera de Montevideo, puede corresponder costo de traslado.');
  });
});

function buildCatalog(locale?: string) {
  if ((locale ?? '').toLowerCase().startsWith('es')) {
    return {
      greetingCues: [
        'hola',
        'buenas',
        'buen día',
        'buen dia',
        'buenas tardes',
        'buenas noches',
      ],
      templates: {
        opening_greeting: 'Hola, gracias por contactarnos.',
        basic_response: 'Hola, contame en qué te puedo ayudar.',
        clarification_requested_date:
          'Para coordinar la visita, necesito la fecha y la hora que te sirven.',
        clarification_quote_scope:
          'Para orientarte con un presupuesto, primero necesito saber qué producto o línea estás evaluando.',
        clarification_user_goal:
          'Decime qué necesitás y lo seguimos desde ahí.',
        clarification_generic: 'Contame un poco más y sigo con eso.',
        execution_success_booking:
          'La reserva fue confirmada para {{scheduledFor}}.',
        execution_success_quote:
          'La cotización preliminar fue creada por {{currency}} {{estimatedTotal}}.',
        execution_success_product: 'Encontré {{name}} por {{currency}} {{price}}.',
        execution_success_generic:
          'La acción solicitada se ejecutó correctamente.',
        execution_failure_unknown_tool:
          'No pude completar {{actionLabel}} porque la capacidad aprobada no está disponible.',
        execution_failure_validation:
          'No pude completar {{actionLabel}} con la información disponible.',
        execution_failure_generic:
          'No pude completar {{actionLabel}} por un error durante la ejecución.',
        document_not_found:
          'Por ahora no tengo una confirmación clara sobre eso.',
        close_turn_acknowledgement:
          'Gracias por escribir. Quedamos a disposición por cualquier otra duda.',
        close_turn_resolved:
          'Perfecto, gracias por avisar. Si surge algo más, estamos a disposición.',
      },
      templateVariants: {
        opening_greeting: [
          'Hola, gracias por contactarnos.',
        ],
        basic_response: [
          'Hola, contame en qué te puedo ayudar.',
          'Decime qué necesitás y te doy una mano.',
          'Contame qué querés resolver y lo vemos.',
        ],
        clarification_requested_date: [
          'Para coordinar la visita, necesito la fecha y la hora que te sirven.',
          'Decime qué día y horario querés para poder agendar la visita.',
          'Indicame cuándo te queda bien la visita y sigo con eso.',
        ],
        clarification_quote_scope: [
          'Para orientarte con un presupuesto, primero necesito saber qué producto o línea estás evaluando.',
        ],
        clarification_user_goal: [
          'Decime qué necesitás y lo seguimos desde ahí.',
          'Contame qué querés resolver y continúo con eso.',
          'Dame un poco más de contexto sobre lo que necesitás y avanzo.',
        ],
        clarification_generic: [
          'Contame un poco más y sigo con eso.',
          'Dame un poco más de detalle y continúo.',
          'Contame un poco más para poder avanzar.',
        ],
        document_not_found: [
          'Por ahora no tengo una confirmación clara sobre eso.',
        ],
        close_turn_acknowledgement: [
          'Gracias por escribir. Quedamos a disposición por cualquier otra duda.',
        ],
        close_turn_resolved: [
          'Perfecto, gracias por avisar. Si surge algo más, estamos a disposición.',
        ],
      },
      actionLabels: {
        create_booking: 'la reserva solicitada',
        create_quote: 'la cotización solicitada',
        get_product: 'la consulta de producto solicitada',
        default: 'la solicitud aprobada',
      },
      defaults: {
        scheduledFor: 'la fecha solicitada',
        currency: 'USD',
        amount: '0.00',
        productName: 'el producto solicitado',
      },
    };
  }

  return {
    greetingCues: [
      'hello',
      'hi',
      'good morning',
      'good afternoon',
      'good evening',
    ],
    templates: {
      opening_greeting: 'Hello, thanks for reaching out.',
      basic_response: 'Hi, tell me how I can help.',
      clarification_requested_date: 'To schedule the visit, I need the requested date and time.',
      clarification_quote_scope:
        'To guide you with a quote, I first need to know which product or line you are considering.',
      clarification_user_goal:
        "Tell me what you need and I'll keep going from there.",
      clarification_generic: "Share a little more detail and I'll keep going.",
      execution_success_booking:
        'The booking was confirmed for {{scheduledFor}}.',
      execution_success_quote:
        'The preliminary quote was created for {{currency}} {{estimatedTotal}}.',
      execution_success_product: 'I found {{name}} for {{currency}} {{price}}.',
      execution_success_generic:
        'The requested action was executed successfully.',
      execution_failure_unknown_tool:
        'I could not complete {{actionLabel}} because the approved capability is not available.',
      execution_failure_validation:
        'I could not complete {{actionLabel}} with the available information.',
      execution_failure_generic:
        'I could not complete {{actionLabel}} because of an execution error.',
      document_not_found:
        "I don't have a clear confirmation on that right now.",
      close_turn_acknowledgement:
        'Thanks for reaching out. We are here if you need anything else.',
      close_turn_resolved:
        'Understood, thanks for letting us know. If anything else comes up, we are here to help.',
    },
    templateVariants: {
      opening_greeting: [
        'Hello, thanks for reaching out.',
      ],
      basic_response: [
        'Hi, tell me how I can help.',
        "Tell me what you need and I'll take it from there.",
        "Let me know what you'd like to sort out.",
      ],
      clarification_requested_date: [
        'To schedule the visit, I need the requested date and time.',
        "Tell me the day and time that work for you so I can schedule the visit.",
        "Let me know when you'd like the visit and I'll keep going.",
      ],
      clarification_quote_scope: [
        'To guide you with a quote, I first need to know which product or line you are considering.',
      ],
      clarification_user_goal: [
        "Tell me what you need and I'll keep going from there.",
        "Let me know what you want to sort out and I'll continue from there.",
        'I need a bit more detail about what you need so I can move forward.',
      ],
      clarification_generic: [
        "Share a little more detail and I'll keep going.",
        'Tell me a bit more so I can move forward.',
        'A little more context will help me answer better.',
      ],
      document_not_found: [
        "I don't have a clear confirmation on that right now.",
      ],
      close_turn_acknowledgement: [
        'Thanks for reaching out. We are here if you need anything else.',
      ],
      close_turn_resolved: [
        'Understood, thanks for letting us know. If anything else comes up, we are here to help.',
      ],
    },
    actionLabels: {
      create_booking: 'the requested booking',
      create_quote: 'the requested quote',
      get_product: 'the requested product lookup',
      default: 'the approved request',
    },
    defaults: {
      scheduledFor: 'the requested date',
      currency: 'USD',
      amount: '0.00',
      productName: 'the requested product',
    },
  };
}
