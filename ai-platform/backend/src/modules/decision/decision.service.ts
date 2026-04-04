import { Injectable } from '@nestjs/common';

import { ContinuityAwareInterpretation } from '../continuity/continuity.types';
import { ConversationSignalResolverService } from '../conversation-signals/conversation-signal-resolver.service';
import { ConversationRoutingSignals } from '../conversation-signals/conversation-signal.types';
import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { TenantCapabilityRegistryService } from '../tenant-capabilities/tenant-capability-registry.service';
import { ProductCatalogService } from '../tools/product-catalog.service';
import { DecisionInput, DecisionResult } from './decision.types';

@Injectable()
export class DecisionService {
  constructor(
    private readonly logger: PipelineLoggerService,
    private readonly productCatalogService: ProductCatalogService,
    private readonly conversationSignalResolver: ConversationSignalResolverService,
    private readonly tenantCapabilityRegistry: TenantCapabilityRegistryService,
  ) {}

  decide(
    input: DecisionInput | ContinuityAwareInterpretation,
  ): Promise<DecisionResult> {
    const normalizedInput = this.normalizeInput(input);
    return this.resolveDecision(normalizedInput);
  }

  private async resolveDecision(input: DecisionInput): Promise<DecisionResult> {
    const interpretation = input.interpretation;
    const continuityApplied = interpretation.continuity?.applied === true;
    const continuityMissingFields = this.resolveContinuityMissingFields(input);
    const signals = this.resolveSignals(input);
    const productCatalogMatch = await this.resolveProductCatalogMatch(input);
    const capabilities =
      await this.tenantCapabilityRegistry.resolveForCurrentTenant();
    const decision = this.resolveDecisionFromSignals({
      input,
      interpretation,
      continuityApplied,
      continuityMissingFields,
      signals,
      productCatalogMatch,
      capabilities,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'decision',
        output: decision,
      }),
    );

    return decision;
  }

  private resolveDecisionFromSignals(input: {
    input: DecisionInput;
    interpretation: DecisionInput['interpretation'];
    continuityApplied: boolean;
    continuityMissingFields: string[];
    signals: ConversationRoutingSignals;
    productCatalogMatch: Awaited<
      ReturnType<DecisionService['resolveProductCatalogMatch']>
    >;
    capabilities: Awaited<
      ReturnType<TenantCapabilityRegistryService['resolveForCurrentTenant']>
    >;
  }): DecisionResult {
    const {
      input: normalizedInput,
      interpretation,
      continuityApplied,
      continuityMissingFields,
      signals,
      productCatalogMatch,
      capabilities,
    } = input;

    if (interpretation.intent === 'CREATE_BOOKING') {
      if (!capabilities.capabilities.booking.enabled) {
        return this.buildRespondDecision('booking_capability_disabled');
      }

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
      if (!capabilities.capabilities.quote.enabled) {
        return this.buildRespondDecision('quote_capability_disabled');
      }

      return {
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'create_quote',
        reasonCode: 'quote_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.quote.confirmation',
      };
    }

    if (
      this.shouldCloseTurn(
        normalizedInput,
        signals,
        productCatalogMatch.matched,
        continuityMissingFields,
      )
    ) {
      return {
        domain: 'core',
        action: 'close_turn',
        reasonCode: signals.closure.decline
          ? 'contextual_close_declined'
          : 'contextual_close_acknowledged',
        missingFields: [],
        responseTemplateKey: 'core.close_turn',
      };
    }

    if (
      this.shouldStayInDocumentExploration(
        normalizedInput,
        productCatalogMatch.matched,
      )
    ) {
      return this.buildRespondDecision('document_grounded_exploration');
    }

    if (
      this.shouldStayInAdvisoryExploration(
        normalizedInput,
        signals,
        productCatalogMatch.matched,
      )
    ) {
      return this.buildRespondDecision('advisory_exploration');
    }

    if (
      this.shouldPreferContextualResponse(
        normalizedInput,
        signals,
        continuityMissingFields,
        productCatalogMatch.matched,
      )
    ) {
      return this.buildRespondDecision('contextual_follow_up');
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
      if (!capabilities.capabilities.product_catalog_lookup.enabled) {
        return this.buildRespondDecision('product_lookup_capability_disabled');
      }

      if (productCatalogMatch.matched) {
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

  private shouldCloseTurn(
    input: DecisionInput,
    signals: ConversationRoutingSignals,
    hasGroundedProductMatch: boolean,
    continuityMissingFields: string[],
  ) {
    if (!signals.closure.supported) {
      return false;
    }

    if (
      input.interpretation.intent === 'CREATE_BOOKING' ||
      input.interpretation.intent === 'CREATE_QUOTE'
    ) {
      return false;
    }

    if (
      continuityMissingFields.length > 0 ||
      (input.conversationState?.missingFields.length ?? 0) > 0 ||
      input.conversationState?.nextUsefulField
    ) {
      return false;
    }

    if (
      hasGroundedProductMatch ||
      signals.document.explicitRequest ||
      signals.advisory.supported ||
      signals.advisory.questionLike ||
      input.interpretation.normalizedEntities.dates.length > 0 ||
      input.interpretation.normalizedEntities.measurements.length > 0 ||
      input.interpretation.normalizedEntities.dimensions.length > 0
    ) {
      return false;
    }

    const lastApprovedAction =
      input.conversationState?.lastApprovedAction ??
      input.interpretation.continuity?.previousStateSummary?.lastApprovedAction;
    const priorFlowComplete = Boolean(
      input.conversationState &&
        input.conversationState.missingFields.length === 0 &&
        (lastApprovedAction === 'invoke_tool' ||
          lastApprovedAction === 'respond' ||
          lastApprovedAction === 'close_turn'),
    );

    if (signals.closure.decline || signals.closure.farewell) {
      return priorFlowComplete;
    }

    return signals.closure.gratitude && priorFlowComplete;
  }

  private shouldStayInDocumentExploration(
    input: DecisionInput,
    hasGroundedProductMatch: boolean,
  ) {
    const result = input.documentRetrieval?.result;

    if (!result) {
      return false;
    }

    if (input.interpretation.intent === 'CREATE_QUOTE') {
      return false;
    }

    if (result.matches.length > 0 && result.groundedSummary.trim().length > 0) {
      return true;
    }

    if (hasGroundedProductMatch) {
      return false;
    }

    return (
      input.documentRetrieval?.reason === 'document_query' ||
      input.documentRetrieval?.reason === 'knowledge_query' ||
      input.documentRetrieval?.reason === 'active_document_continuation'
    );
  }

  private shouldStayInAdvisoryExploration(
    input: DecisionInput,
    signals: ConversationRoutingSignals,
    hasGroundedProductMatch: boolean,
  ) {
    const activeLane = this.resolveActiveLane(input);

    if (
      activeLane === 'advisory_exploration' &&
      input.interpretation.intent !== 'CREATE_QUOTE' &&
      !hasGroundedProductMatch
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

    if (hasGroundedProductMatch) {
      return false;
    }

    if (input.interpretation.intent === 'GET_PRODUCT') {
      return signals.advisory.lexicalScore > 0;
    }

    return signals.advisory.supported;
  }

  private shouldPreferContextualResponse(
    input: DecisionInput,
    signals: ConversationRoutingSignals,
    continuityMissingFields: string[],
    hasGroundedProductMatch: boolean,
  ) {
    const activeLane = this.resolveActiveLane(input);
    const lastApprovedAction =
      input.conversationState?.lastApprovedAction ??
      input.interpretation.continuity?.previousStateSummary?.lastApprovedAction;

    if (!activeLane) {
      return false;
    }

    if (
      signals.threading.switchSuggested ||
      signals.noise.channelInterference ||
      continuityMissingFields.length > 0 ||
      input.documentRetrieval?.result ||
      signals.document.continuationEligible
    ) {
      return false;
    }

    if (
      input.interpretation.intent === 'CREATE_BOOKING' ||
      input.interpretation.intent === 'CREATE_QUOTE'
    ) {
      return false;
    }

    if (
      activeLane === 'advisory_exploration' ||
      activeLane === 'document_exploration'
    ) {
      return false;
    }

    if (hasGroundedProductMatch && activeLane !== 'product_lookup') {
      return false;
    }

    if (
      lastApprovedAction !== 'respond' &&
      lastApprovedAction !== 'invoke_tool' &&
      lastApprovedAction !== 'close_turn'
    ) {
      return false;
    }

    return (
      signals.threading.activeContinuation ||
      signals.threading.resume ||
      signals.threading.shortFollowUp
    );
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

  private resolveSignals(input: DecisionInput) {
    if (input.signals) {
      return input.signals;
    }

    return this.conversationSignalResolver.resolve({
      message: this.resolvePrimaryMessage(input.interpretation),
      interpretation: input.interpretation,
      conversationState: input.conversationState,
    });
  }

  private async resolveProductCatalogMatch(input: DecisionInput) {
    if (input.interpretation.intent !== 'GET_PRODUCT') {
      return {
        matched: false as const,
        matchedBy: null,
        product: null,
        score: 0,
      };
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
    });
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
