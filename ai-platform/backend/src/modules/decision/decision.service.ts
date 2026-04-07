import { Injectable } from '@nestjs/common';

import { ContinuityAwareInterpretation } from '../continuity/continuity.types';
import {
  normalizeConversationSignalText,
  resolveConversationSignalCatalog,
  tokenizeConversationSignalText,
} from '../conversation-signals/conversation-signal.catalogs';
import { ConversationSignalResolverService } from '../conversation-signals/conversation-signal-resolver.service';
import { ConversationRoutingSignals } from '../conversation-signals/conversation-signal.types';
import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import {
  expandGroundingEquivalentTokens,
  resolveResponseGroundingCatalog,
} from '../response/response-grounding.catalogs';
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

    const informationalTransactionalTurn =
      this.shouldTreatTransactionalIntentAsInformational(
        normalizedInput,
        signals,
      );

    if (
      this.shouldCloseTurn(
        normalizedInput,
        signals,
        productCatalogMatch.matched,
        continuityMissingFields,
        informationalTransactionalTurn,
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

    if (interpretation.intent === 'CREATE_BOOKING' && !informationalTransactionalTurn) {
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

    if (interpretation.intent === 'CREATE_QUOTE' && !informationalTransactionalTurn) {
      if (!capabilities.capabilities.quote.enabled) {
        return this.buildRespondDecision('quote_capability_disabled');
      }

      const quoteMissingFields = this.resolveQuoteMissingFields({
        input: normalizedInput,
        productCatalogMatch,
      });

      if (quoteMissingFields.length > 0) {
        return {
          domain: 'core',
          action: 'clarify',
          reasonCode: 'quote_missing_scope',
          missingFields: quoteMissingFields,
          responseTemplateKey: 'core.clarification_quote_scope',
        };
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
    informationalTransactionalTurn = false,
  ) {
    if (!signals.closure.supported) {
      return false;
    }

    if (this.isPureClosureTurn(input, signals)) {
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

      return (
        priorFlowComplete ||
        this.isStaleTransactionalClarificationLoop(
          input,
          continuityMissingFields,
          informationalTransactionalTurn,
        )
      );
    }

    if (
      (input.interpretation.intent === 'CREATE_BOOKING' ||
        input.interpretation.intent === 'CREATE_QUOTE') &&
      !informationalTransactionalTurn
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

    if (signals.closure.decline || signals.closure.farewell) {
      return priorFlowComplete;
    }

    return signals.closure.gratitude && priorFlowComplete;
  }

  private shouldTreatTransactionalIntentAsInformational(
    input: DecisionInput,
    signals: ConversationRoutingSignals,
  ) {
    const transactionalIntent =
      input.interpretation.intent === 'CREATE_BOOKING' ||
      input.interpretation.intent === 'CREATE_QUOTE';
    const activeLane = this.resolveActiveLane(input);
    const transactionalLane =
      input.interpretation.intent === 'CREATE_BOOKING'
        ? 'booking'
        : input.interpretation.intent === 'CREATE_QUOTE'
          ? 'quote'
          : activeLane === 'booking' || activeLane === 'quote'
            ? activeLane
            : null;
    const hasExplorationContext =
      activeLane === 'document_exploration' ||
      activeLane === 'advisory_exploration' ||
      input.conversationState?.lane === 'document_exploration' ||
      input.conversationState?.lane === 'advisory_exploration';
    const hasThreadedContext =
      hasExplorationContext ||
      Boolean(input.conversationState) ||
      Boolean(input.interpretation.continuity?.previousStateSummary);

    if (!transactionalIntent && !transactionalLane) {
      return false;
    }

    if (this.hasConcreteTransactionalProgression(input)) {
      return false;
    }

    if (this.isPureClosureTurn(input, signals)) {
      return true;
    }

    if (input.documentRetrieval?.result) {
      return true;
    }

    return (
      signals.document.explicitRequest ||
      signals.document.implicitEligible ||
      signals.document.continuationEligible ||
      signals.advisory.supported ||
      signals.advisory.questionLike ||
      (hasThreadedContext &&
        (signals.threading.topicCarryoverEligible ||
          signals.threading.activeContinuation ||
          signals.threading.shortFollowUp ||
          signals.threading.incrementalFollowUp))
    );
  }

  private hasConcreteTransactionalProgression(input: DecisionInput) {
    return (
      input.interpretation.normalizedEntities.dates.length > 0 ||
      input.interpretation.normalizedEntities.measurements.length > 0 ||
      input.interpretation.normalizedEntities.dimensions.length > 0
    );
  }

  private resolveQuoteMissingFields(input: {
    input: DecisionInput;
    productCatalogMatch: Awaited<
      ReturnType<DecisionService['resolveProductCatalogMatch']>
    >;
  }) {
    const readiness = this.resolveQuoteReadiness(
      input.input,
      input.productCatalogMatch.matched,
    );

    if (readiness.ready) {
      return [];
    }

    return readiness.missingFields;
  }

  private resolveQuoteReadiness(
    input: DecisionInput,
    hasGroundedProductMatch: boolean,
  ) {
    const hasScope = this.hasMeaningfulQuoteScope(input, hasGroundedProductMatch);

    if (!hasScope) {
      return {
        ready: false as const,
        missingFields: ['quote_scope'],
      };
    }

    return {
      ready: true as const,
      missingFields: [] as string[],
    };
  }

  private hasMeaningfulQuoteScope(
    input: DecisionInput,
    hasGroundedProductMatch: boolean,
  ) {
    if (hasGroundedProductMatch) {
      return true;
    }

    const locale = input.interpretation.language;
    const scopeCandidates = [
      typeof input.interpretation.entities.productQuery === 'string'
        ? input.interpretation.entities.productQuery
        : '',
      typeof input.interpretation.entities.rawMessage === 'string'
        ? input.interpretation.entities.rawMessage
        : '',
      this.resolveStoredSubjectContext(input),
    ].filter((value) => value.trim().length > 0);

    return scopeCandidates.some((candidate) =>
      hasMeaningfulQuoteScopeTokens(candidate, locale),
    );
  }

  private isPureClosureTurn(
    input: DecisionInput,
    signals: ConversationRoutingSignals,
  ) {
    const rawMessage =
      typeof input.interpretation.entities.rawMessage === 'string'
        ? input.interpretation.entities.rawMessage.trim()
        : '';
    const tokenCount = rawMessage
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 0).length;

    if (!rawMessage || /[?¿]/u.test(rawMessage)) {
      return false;
    }

    if (tokenCount > 6) {
      return false;
    }

    if (
      input.interpretation.normalizedEntities.dates.length > 0 ||
      input.interpretation.normalizedEntities.measurements.length > 0 ||
      input.interpretation.normalizedEntities.dimensions.length > 0
    ) {
      return false;
    }

    if (signals.document.explicitRequest) {
      return false;
    }

    if (signals.advisory.questionLike) {
      return false;
    }

    return (
      signals.closure.decline ||
      signals.closure.farewell ||
      signals.closure.gratitude
    );
  }

  private isStaleTransactionalClarificationLoop(
    input: DecisionInput,
    continuityMissingFields: string[],
    informationalTransactionalTurn: boolean,
  ) {
    if (!this.resolveActiveLane(input)) {
      return false;
    }

    if (
      continuityMissingFields.length === 0 &&
      (input.conversationState?.missingFields.length ?? 0) === 0 &&
      !input.conversationState?.nextUsefulField
    ) {
      return false;
    }

    const lastApprovedAction =
      input.conversationState?.lastApprovedAction ??
      input.interpretation.continuity?.previousStateSummary?.lastApprovedAction;

    return (
      informationalTransactionalTurn ||
      lastApprovedAction === 'clarify' ||
      lastApprovedAction === null ||
      lastApprovedAction === undefined
    );
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
      activeLane &&
      activeLane !== 'advisory_exploration' &&
      activeLane !== 'document_exploration'
    ) {
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
      return (
        signals.advisory.lexicalScore > 0 ||
        signals.threading.topicCarryoverEligible
      );
    }

    return signals.advisory.supported || signals.threading.topicCarryoverEligible;
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

  private resolveStoredSubjectContext(input: DecisionInput) {
    const approvedFacts =
      input.conversationState?.approvedFacts &&
      typeof input.conversationState.approvedFacts === 'object'
        ? (input.conversationState.approvedFacts as Record<string, unknown>)
        : null;

    const storedValues = [
      typeof approvedFacts?.subjectSummary === 'string'
        ? approvedFacts.subjectSummary
        : '',
      typeof approvedFacts?.topicSummary === 'string'
        ? approvedFacts.topicSummary
        : '',
      typeof approvedFacts?.requestSummary === 'string'
        ? approvedFacts.requestSummary
        : '',
    ].filter((value) => value.trim().length > 0);

    return storedValues[0] ?? '';
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

function hasMeaningfulQuoteScopeTokens(value: string, locale?: string | null) {
  const normalized = normalizeConversationSignalText(value);

  if (!normalized) {
    return false;
  }

  const catalog = resolveResponseGroundingCatalog(locale);
  const excludedTokens = new Set(
    expandGroundingEquivalentTokens(locale, [
      ...(catalog.detailTypes.quote_requirements?.requestTerms ?? []),
      ...(catalog.detailTypes.quote_requirements?.generalEvidenceTerms ?? []),
      ...catalog.subjectAlignmentSignals.stopTerms,
      'un',
      'una',
      'unos',
      'unas',
    ]).map((term) => normalizeConversationSignalText(term)),
  );
  const genericFamilyTokens = new Set(
    catalog.subjectEquivalenceSignals.groups.flatMap((group) => group),
  );
  const scopedTokens = expandGroundingEquivalentTokens(
    locale,
    tokenizeConversationSignalText(value, {
      locale,
      minimumTokenLength: 3,
      stopWordSet: 'retrieval',
    }),
  ).filter(
    (token) =>
      token.length >= 3 &&
      /[\p{L}]/u.test(token) &&
      !/^\d+(?:x\d+)+$/u.test(token) &&
      !excludedTokens.has(token),
  );
  const distinctTokens = Array.from(new Set(scopedTokens));
  const qualifierTokens = distinctTokens.filter(
    (token) => !genericFamilyTokens.has(token),
  );

  return distinctTokens.length >= 2 && qualifierTokens.length >= 1;
}
