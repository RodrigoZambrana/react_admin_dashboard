import { AdminTestCenterEvaluationService } from '../src/modules/api/admin-test-center-evaluation.service';

describe('AdminTestCenterEvaluationService', () => {
  const service = new AdminTestCenterEvaluationService();

  it('scores a supported payment scenario with natural customer-facing answers', () => {
    const evaluation = service.evaluateScenarioRun({
      scenario: {
        id: 'scenario-payment',
        label: 'Pagos',
        description: 'desc',
        locale: 'es',
        sourceKind: 'curated',
        category: 'supported_information',
        tags: [],
        turns: [
          {
            message: 'que formas de pago aceptan?',
            expectation: {
              topicTerms: ['pago', 'transferencia', 'efectivo', 'mercado pago'],
              mustMentionAtLeast: [
                {
                  terms: ['transferencia', 'efectivo', 'mercado pago', 'tarjetas'],
                  count: 3,
                },
              ],
              shouldAvoidStructuralSummary: true,
            },
          },
          {
            message: 'muchas gracias',
            expectation: {
              expectedClose: true,
              preferredResponseMode: 'close',
            },
          },
        ],
      },
      turns: [
        {
          input: 'que formas de pago aceptan?',
          locale: 'es',
          traceId: 'trace-1',
          response:
            'Aceptamos transferencia bancaria, efectivo, Mercado Pago y tarjetas.',
          intent: 'GENERAL_CONVERSATION',
          metadata: {
            conversationId: 'conv-1',
            traceId: 'trace-1',
          },
        },
        {
          input: 'muchas gracias',
          locale: 'es',
          traceId: 'trace-2',
          response: 'Gracias por escribirnos. Cualquier otra consulta, quedamos a disposición.',
          intent: 'GENERAL_CONVERSATION',
          metadata: {
            conversationId: 'conv-1',
            traceId: 'trace-2',
          },
        },
      ],
    });

    expect(evaluation.status).toBe('pass');
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(80);
  });

  it('penalizes raw structural summaries and missing close behavior', () => {
    const evaluation = service.evaluateScenarioRun({
      scenario: {
        id: 'scenario-visit',
        label: 'Visita',
        description: 'desc',
        locale: 'es',
        sourceKind: 'curated',
        category: 'edge_case',
        tags: [],
        turns: [
          {
            message: 'gracias',
            expectation: {
              expectedClose: true,
              shouldAvoidStructuralSummary: true,
            },
          },
        ],
      },
      turns: [
        {
          input: 'gracias',
          locale: 'es',
          traceId: 'trace-1',
          response: 'Costo de visita (location Montevideo, location relation inside): sin costo',
          intent: 'GENERAL_CONVERSATION',
          metadata: {
            conversationId: 'conv-2',
            traceId: 'trace-1',
          },
        },
      ],
    });

    expect(evaluation.status).toBe('fail');
    expect(evaluation.turns[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('estructural cruda'),
        expect.stringContaining('No cerró el hilo'),
      ]),
    );
  });

  it('rewards follow-up questions for limited-context turns and multiline formatting when expected', () => {
    const evaluation = service.evaluateScenarioRun({
      scenario: {
        id: 'scenario-limited-context',
        label: 'Contexto limitado',
        description: 'desc',
        locale: 'es',
        sourceKind: 'curated',
        category: 'edge_case',
        tags: [],
        turns: [
          {
            message: 'que materiales tienen?',
            expectation: {
              shouldAskFollowUpQuestion: true,
              shouldAvoidStructuralSummary: true,
            },
          },
          {
            message:
              'estoy en montevideo y quiero saber si toman medidas y si aceptan mercado pago en cuotas',
            expectation: {
              shouldPreferMultiline: true,
              topicTerms: ['montevideo', 'medidas', 'mercado pago', 'cuotas'],
            },
          },
        ],
      },
      turns: [
        {
          input: 'que materiales tienen?',
          locale: 'es',
          traceId: 'trace-1',
          response:
            'Claro. Si además estás evaluando una opción concreta, decime qué producto o línea estás viendo y te oriento con los materiales correctos.',
          intent: 'GENERAL_CONVERSATION',
          metadata: {
            conversationId: 'conv-3',
            traceId: 'trace-1',
          },
        },
        {
          input:
            'estoy en montevideo y quiero saber si toman medidas y si aceptan mercado pago en cuotas',
          locale: 'es',
          traceId: 'trace-2',
          response:
            'Sí, podemos coordinar una visita a domicilio en Montevideo para tomar medidas.\n\nTambién aceptamos Mercado Pago en cuotas, además de transferencia y efectivo.',
          intent: 'GENERAL_CONVERSATION',
          metadata: {
            conversationId: 'conv-3',
            traceId: 'trace-2',
          },
        },
      ],
    });

    expect(evaluation.status).toBe('pass');
    expect(evaluation.turns[0]?.matchedSignals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Pide contexto adicional'),
      ]),
    );
    expect(evaluation.turns[1]?.matchedSignals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Usa multilinea'),
      ]),
    );
    expect(evaluation.turns[1]?.writingQualityScore).toBeGreaterThanOrEqual(95);
  });
});
