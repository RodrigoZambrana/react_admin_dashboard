import { AiGatewayInterpretationResult } from '../src/modules/ai-gateway/ai-gateway.types';
import { ConversationSignalResolverService } from '../src/modules/conversation-signals/conversation-signal-resolver.service';
import { ConversationContinuityService } from '../src/modules/continuity/conversation-continuity.service';
import { DecisionService } from '../src/modules/decision/decision.service';
import { InterpretationService } from '../src/modules/interpretation/interpretation.service';
import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { DateParser } from '../src/modules/parsing/date.parser';
import { DimensionParser } from '../src/modules/parsing/dimension.parser';
import { MeasurementParser } from '../src/modules/parsing/measurement.parser';
import { ParsingService } from '../src/modules/parsing/parsing.service';
import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { CreateBookingTool } from '../src/modules/tools/create-booking.tool';
import { CreateQuoteTool } from '../src/modules/tools/create-quote.tool';
import { GetProductTool } from '../src/modules/tools/get-product.tool';
import { ProductCatalogService } from '../src/modules/tools/product-catalog.service';
import { ToolEngineService } from '../src/modules/tools/tool-engine.service';
import { ToolExecutionService } from '../src/modules/tools/tool-execution.service';
import { buildManagedTemporalLocaleProviderStub } from './support/managed-temporal-provider.stub';

describe('Booking conversation stabilization', () => {
  it('executes a realistic booking request without generic clarification loops', async () => {
    const pipeline = buildBookingPipeline([
      buildGatewayInterpretation({
        intent: 'CREATE_BOOKING',
        confidence: 0.94,
        entities: {
          dateCandidates: ['mañana a las 11'],
        },
      }),
    ]);

    const turn = await pipeline.runTurn(
      'Necesito agendar una visita para mañana a las 11 para cambiar la cadena de una cortina roller.',
    );

    expect(turn.interpretationResult.interpretation.intent).toBe('CREATE_BOOKING');
    expect(turn.parsed.normalizedEntities.dates).toEqual([
      expect.objectContaining({
        source: 'mañana a las 11',
        precision: 'datetime',
      }),
    ]);
    expect(turn.decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'create_booking',
        missingFields: [],
      }),
    );
    expect(turn.execution).toEqual(
      expect.objectContaining({
        ok: true,
        toolName: 'create_booking',
        payload: expect.objectContaining({
          notes:
            'Necesito agendar una visita para mañana a las 11 para cambiar la cadena de una cortina roller.',
        }),
      }),
    );
  });

  it('converges fragmented booking turns through continuity without falling back to user_goal clarification', async () => {
    const pipeline = buildBookingPipeline([
      buildGatewayInterpretation({
        intent: 'CREATE_BOOKING',
        confidence: 0.9,
        entities: {},
      }),
      buildGatewayInterpretation({
        intent: 'CLARIFICATION',
        confidence: 0.32,
        entities: {},
      }),
    ]);

    const openingTurn = await pipeline.runTurn('Quiero agendar una visita');

    expect(openingTurn.decision).toEqual(
      expect.objectContaining({
        action: 'clarify',
        missingFields: ['requested_date'],
      }),
    );

    const followUpTurn = await pipeline.runTurn('Para mañana');

    expect(followUpTurn.prepared.effectiveInterpretation.intent).toBe(
      'CREATE_BOOKING',
    );
    expect(followUpTurn.decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'create_booking',
        missingFields: [],
      }),
    );
    expect(followUpTurn.execution).toEqual(
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          notes: 'Quiero agendar una visita',
        }),
      }),
    );
  });
});

function buildBookingPipeline(
  gatewayResponses: AiGatewayInterpretationResult[],
) {
  const logger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
  const aiGateway = {
    interpret: jest.fn(async () => gatewayResponses.shift()),
  };
  const interpretationService = new InterpretationService(
    aiGateway as any,
    logger as any,
  );
  const parsingService = new ParsingService(
    new DateParser(
      new TemporalExpressionService(
        buildManagedTemporalLocaleProviderStub().provider,
      ),
    ),
    new MeasurementParser(),
    new DimensionParser(),
    logger as any,
  );
  let persistedState: Record<string, unknown> | null = null;
  const stateRepository = {
    findByConversationId: jest.fn(async () => persistedState),
    save: jest.fn(async (input) => {
      persistedState = {
        ...input,
        updatedAt: new Date('2026-04-04T12:00:00.000Z'),
      };
      return persistedState;
    }),
    deleteByConversationId: jest.fn(async () => {
      persistedState = null;
      return { count: 1 };
    }),
  };
  const continuityService = new ConversationContinuityService(
    stateRepository as any,
    logger as any,
    new ConversationSignalResolverService(),
  );
  const decisionService = new DecisionService(
    new PipelineLoggerService(),
    {
      findMatch: jest.fn(async () => ({
        matched: false as const,
        matchedBy: null,
        product: null,
        score: 0,
      })),
    } as unknown as ProductCatalogService,
    new ConversationSignalResolverService(),
    {
      resolveForCurrentTenant: async () => ({
        tenantId: 'tenant-alpha',
        capabilities: {
          booking: {
            key: 'booking',
            enabled: true,
            description: '',
            intents: ['CREATE_BOOKING'],
            tools: ['create_booking'],
          },
          quote: {
            key: 'quote',
            enabled: true,
            description: '',
            intents: ['CREATE_QUOTE'],
            tools: ['create_quote'],
          },
          product_catalog_lookup: {
            key: 'product_catalog_lookup',
            enabled: true,
            description: '',
            intents: ['GET_PRODUCT'],
            tools: ['get_product'],
          },
          support_post_sale: {
            key: 'support_post_sale',
            enabled: true,
            description: '',
            intents: ['GENERAL_CONVERSATION', 'CLARIFICATION'],
            tools: [],
          },
        },
        enabledKeys: [
          'booking',
          'quote',
          'product_catalog_lookup',
          'support_post_sale',
        ],
      }),
    } as any,
  );
  const toolExecutionService = new ToolExecutionService(
    {
      getTenantId: () => 'tenant-alpha',
      getTraceId: () => 'trace-booking',
    } as any,
    new ToolEngineService(
      new PipelineLoggerService(),
      new CreateBookingTool(),
      new GetProductTool({
        findMatch: jest.fn(async () => ({
          matched: false as const,
          matchedBy: null,
          product: null,
          score: 0,
        })),
      } as unknown as ProductCatalogService),
      new CreateQuoteTool(),
    ),
  );

  return {
    async runTurn(message: string) {
      const interpretationResult = await interpretationService.interpret(
        message,
        'es',
      );
      const parsed = await parsingService.normalize(
        interpretationResult.interpretation,
        new Date('2026-04-04T12:00:00.000Z'),
      );
      const prepared = await continuityService.prepareTurn({
        conversationId: 'conv-booking-stabilization',
        interpretation: parsed,
      });
      const decision = await decisionService.decide(
        prepared.effectiveInterpretation,
      );
      const execution = await toolExecutionService.executeApprovedAction({
        decision,
        interpretation: prepared.effectiveInterpretation,
      });
      const conversationState = await continuityService.persistTurnState({
        conversationId: 'conv-booking-stabilization',
        preparedTurn: prepared,
        decision,
        execution,
        documentRetrieval: {
          attempted: false,
          reason: 'not_requested',
          result: null,
        },
      });

      return {
        interpretationResult,
        parsed,
        prepared,
        decision,
        execution,
        conversationState,
      };
    },
  };
}

function buildGatewayInterpretation(input: {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
}): AiGatewayInterpretationResult {
  const parsedResponse = {
    intent: input.intent,
    entities: input.entities,
    language: 'es',
    confidence: input.confidence,
  };

  return {
    ok: true,
    rawResponse: JSON.stringify(parsedResponse),
    parsedResponse,
    error: null,
    provider: 'openai',
    model: 'gpt-4.1-mini',
  };
}
