import { Injectable } from '@nestjs/common';

import { ContinuityAwareInterpretation } from '../continuity/continuity.types';
import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { ProductCatalogService } from '../tools/product-catalog.service';
import { DecisionInput, DecisionResult } from './decision.types';

const advisoryCuePatterns = [
  /\b(recom(?:enda|iendas|endar|endas?)|recommend|recommended)\b/i,
  /\b(conviene|mejor|better|best|ideal|suitable|suit)\b/i,
  /\b(compare|compar|difference|diferencia|versus|vs)\b/i,
  /\b(option|opcion|opciones|alternativa|alternativas)\b/i,
  /\b(choose|elegir|elegirias|prefer|prefiero|prefieres)\b/i,
] as const;

@Injectable()
export class DecisionService {
  constructor(
    private readonly logger: PipelineLoggerService,
    private readonly productCatalogService: ProductCatalogService,
  ) {}

  decide(
    input: DecisionInput | ContinuityAwareInterpretation,
  ): DecisionResult {
    const normalizedInput = this.normalizeInput(input);
    const decision = this.resolveDecision(normalizedInput);

    this.logger.log(
      JSON.stringify({
        stage: 'decision',
        output: decision,
      }),
    );

    return decision;
  }

  private resolveDecision(input: DecisionInput): DecisionResult {
    const interpretation = input.interpretation;
    const continuityApplied = interpretation.continuity?.applied === true;
    const continuityMissingFields = this.resolveContinuityMissingFields(input);

    if (interpretation.intent === 'CREATE_BOOKING') {
      const missingFields = interpretation.normalizedEntities.dates.length
        ? []
        : ['requested_date'];

      if (missingFields.length > 0) {
        return {
          domain: 'core',
          action: 'clarify',
          reasonCode: 'booking_missing_fields',
          missingFields,
          responseTemplateKey: 'core.clarification',
        };
      }

      return {
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'create_booking',
        reasonCode: 'booking_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.booking.confirmation',
      };
    }

    if (interpretation.intent === 'CREATE_QUOTE') {
      return {
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'create_quote',
        reasonCode: 'quote_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.quote.confirmation',
      };
    }

    if (this.shouldStayInDocumentExploration(input)) {
      return this.buildRespondDecision('document_grounded_exploration');
    }

    if (this.shouldStayInAdvisoryExploration(input)) {
      return this.buildRespondDecision('advisory_exploration');
    }

    if (
      !continuityApplied &&
      (interpretation.confidence < 0.6 || interpretation.intent === 'CLARIFICATION')
    ) {
      return {
        domain: 'core',
        action: 'clarify',
        reasonCode: continuityMissingFields.length
          ? 'continuity_missing_fields'
          : 'low_confidence_or_clarification',
        missingFields:
          continuityMissingFields.length > 0
            ? continuityMissingFields
            : ['user_goal'],
        responseTemplateKey: 'core.clarification',
      };
    }

    if (interpretation.intent === 'GET_PRODUCT') {
      if (this.canInvokeProductLookup(input)) {
        return {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'get_product',
          reasonCode: 'product_lookup_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.ecommerce.product_result',
        };
      }

      return this.buildRespondDecision('product_lookup_not_grounded');
    }

    return this.buildRespondDecision('general_conversation');
  }

  private shouldStayInDocumentExploration(input: DecisionInput) {
    if (!input.documentRetrieval?.result) {
      return false;
    }

    return input.interpretation.intent !== 'CREATE_QUOTE';
  }

  private shouldStayInAdvisoryExploration(input: DecisionInput) {
    const activeLane = this.resolveActiveLane(input);

    if (
      activeLane === 'advisory_exploration' &&
      input.interpretation.intent !== 'CREATE_QUOTE' &&
      !this.canInvokeProductLookup(input)
    ) {
      return true;
    }

    if (input.documentRetrieval?.result) {
      return false;
    }

    if (
      input.interpretation.intent !== 'GENERAL_CONVERSATION' &&
      input.interpretation.intent !== 'CLARIFICATION' &&
      input.interpretation.intent !== 'GET_PRODUCT'
    ) {
      return false;
    }

    if (this.canInvokeProductLookup(input)) {
      return false;
    }

    return this.hasAdvisorySignals(input.interpretation);
  }

  private hasAdvisorySignals(interpretation: ContinuityAwareInterpretation) {
    const rawMessage = this.resolvePrimaryMessage(interpretation);

    if (rawMessage.length === 0) {
      return false;
    }

    if (advisoryCuePatterns.some((pattern) => pattern.test(rawMessage))) {
      return true;
    }

    if (interpretation.intent === 'GET_PRODUCT') {
      return rawMessage.length >= 12;
    }

    return rawMessage.includes('?') || rawMessage.length >= 24;
  }

  private canInvokeProductLookup(input: DecisionInput) {
    if (input.interpretation.intent !== 'GET_PRODUCT') {
      return false;
    }

    const sku =
      typeof input.interpretation.entities.sku === 'string'
        ? input.interpretation.entities.sku
        : undefined;
    const query =
      typeof input.interpretation.entities.productQuery === 'string'
        ? input.interpretation.entities.productQuery
        : this.resolvePrimaryMessage(input.interpretation);

    return this.productCatalogService.findMatch({
      sku,
      query,
    }).matched;
  }

  private resolveContinuityMissingFields(input: DecisionInput) {
    if (!input.interpretation.continuity?.activeLane) {
      return [];
    }

    const continuityFields = input.interpretation.continuity.missingFields.filter(
      (value) => value.trim().length > 0,
    );

    if (continuityFields.length > 0) {
      return continuityFields;
    }

    if (
      input.interpretation.continuity.nextUsefulField &&
      input.interpretation.continuity.nextUsefulField.trim().length > 0
    ) {
      return [input.interpretation.continuity.nextUsefulField];
    }

    return [];
  }

  private resolvePrimaryMessage(interpretation: ContinuityAwareInterpretation) {
    if (
      typeof interpretation.entities.requestSummary === 'string' &&
      interpretation.entities.requestSummary.trim().length > 0
    ) {
      return interpretation.entities.requestSummary.trim();
    }

    if (
      typeof interpretation.entities.productQuery === 'string' &&
      interpretation.entities.productQuery.trim().length > 0
    ) {
      return interpretation.entities.productQuery.trim();
    }

    if (
      typeof interpretation.entities.rawMessage === 'string' &&
      interpretation.entities.rawMessage.trim().length > 0
    ) {
      return interpretation.entities.rawMessage.trim();
    }

    return '';
  }

  private resolveActiveLane(input: DecisionInput) {
    return (
      input.interpretation.continuity?.activeLane ??
      input.conversationState?.lane ??
      null
    );
  }

  private buildRespondDecision(reasonCode: string): DecisionResult {
    return {
      domain: 'core',
      action: 'respond',
      reasonCode,
      missingFields: [],
      responseTemplateKey: 'core.general_response',
    };
  }

  private normalizeInput(
    input: DecisionInput | ContinuityAwareInterpretation,
  ): DecisionInput {
    if ('interpretation' in input) {
      return input;
    }

    return {
      interpretation: input,
      conversationState: null,
      documentRetrieval: null,
    };
  }
}
