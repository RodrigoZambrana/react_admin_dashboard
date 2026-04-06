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
});
