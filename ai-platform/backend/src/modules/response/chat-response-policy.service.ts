import { Injectable } from '@nestjs/common';

import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import { ResponseGroundingService } from './response-grounding.service';
import { ApprovedResponseContext } from './response.types';

@Injectable()
export class ChatResponsePolicyService {
  constructor(
    private readonly responseFallbackService: ResponseFallbackService,
    private readonly responseGroundingService: ResponseGroundingService,
  ) {}

  async resolve(context: ApprovedResponseContext) {
    const baseResponse = await this.resolveBaseResponse(context);
    const greetedResponse = await this.applyOpeningGreeting(context, baseResponse);
    return this.applyMultilineLayout(context, greetedResponse);
  }

  private async resolveBaseResponse(context: ApprovedResponseContext) {
    if (context.outcome === 'close_turn') {
      return this.buildCloseTurnResponse(context);
    }

    if (context.documentContext) {
      return this.buildDocumentAwareResponse(context);
    }

    if (context.outcome === 'clarify') {
      return this.buildClarificationResponse(context);
    }

    if (context.outcome === 'execution_succeeded') {
      return this.buildExecutionSuccessResponse(context);
    }

    if (context.outcome === 'execution_failed') {
      return this.buildExecutionFailureResponse(context);
    }

    return this.buildBasicResponse(context);
  }

  private async buildDocumentAwareResponse(context: ApprovedResponseContext) {
    const groundedSummary = context.documentContext?.groundedSummary?.trim();
    const matchBackedSummary = this.buildMatchBackedDocumentSummary(context);
    const effectiveSummary = groundedSummary || matchBackedSummary;
    const supportLevel = context.documentContext?.grounding.supportLevel;
    const hasMatches = (context.documentContext?.matches.length ?? 0) > 0;
    const missingSummaryResponse = await this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'document_not_found',
      variationSeed: this.buildVariationSeed(context, 'document_not_found'),
    });
    const unavailableKnowledgeResponse =
      this.buildUnavailableKnowledgeResponse(context, missingSummaryResponse);

    if (!effectiveSummary && supportLevel === 'unavailable' && !hasMatches) {
      if (context.outcome === 'clarify') {
        return this.composeWithDocumentSummary(
          unavailableKnowledgeResponse,
          await this.buildClarificationResponse(context),
        );
      }

      if (context.outcome === 'execution_succeeded') {
        return this.composeWithDocumentSummary(
          unavailableKnowledgeResponse,
          await this.buildExecutionSuccessResponse(context),
        );
      }

      if (context.outcome === 'execution_failed') {
        return this.composeWithDocumentSummary(
          unavailableKnowledgeResponse,
          await this.buildExecutionFailureResponse(context),
        );
      }

      return unavailableKnowledgeResponse;
    }

    const responseSummary =
      context.documentContext?.responseMode === 'combined_execution'
        ? this.buildCombinedDocumentSummary(context, effectiveSummary)
        : this.buildDocumentGroundingSummary(context, effectiveSummary);

    if (context.outcome === 'clarify') {
      return this.composeWithDocumentSummary(
        responseSummary,
        await this.buildClarificationResponse(context),
      );
    }

    if (context.outcome === 'execution_succeeded') {
      return this.composeWithDocumentSummary(
        responseSummary,
        await this.buildExecutionSuccessResponse(context),
      );
    }

    if (context.outcome === 'execution_failed') {
      return this.composeWithDocumentSummary(
        responseSummary,
        await this.buildExecutionFailureResponse(context),
      );
    }

    return responseSummary;
  }

  private async buildCloseTurnResponse(context: ApprovedResponseContext) {
    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey:
        context.decision.reasonCode === 'contextual_close_declined'
          ? 'close_turn_resolved'
          : 'close_turn_acknowledgement',
      variationSeed: this.buildVariationSeed(
        context,
        context.decision.reasonCode === 'contextual_close_declined'
          ? 'close_turn_resolved'
          : 'close_turn_acknowledgement',
      ),
    });
  }

  private async buildBasicResponse(context: ApprovedResponseContext) {
    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'basic_response',
      variationSeed: this.buildVariationSeed(context, 'basic_response'),
    });
  }

  private async buildClarificationResponse(context: ApprovedResponseContext) {
    const missingFields = context.missingFields ?? [];

    if (missingFields.includes('requested_date')) {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'clarification_requested_date',
        variationSeed: this.buildVariationSeed(
          context,
          'clarification_requested_date',
        ),
      });
    }

    if (missingFields.includes('user_goal')) {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'clarification_user_goal',
        variationSeed: this.buildVariationSeed(context, 'clarification_user_goal'),
      });
    }

    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'clarification_generic',
      variationSeed: this.buildVariationSeed(context, 'clarification_generic'),
    });
  }

  private async buildExecutionSuccessResponse(context: ApprovedResponseContext) {
    const execution = context.execution;
    const defaults = await this.responseFallbackService.getDefaults(context.locale);

    if (context.decision.toolName === 'create_booking') {
      const scheduledFor =
        typeof execution.resultSummary?.scheduledFor === 'string'
          ? execution.resultSummary.scheduledFor
          : defaults.scheduledFor;

      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_success_booking',
        variables: {
          scheduledFor,
        },
      });
    }

    if (context.decision.toolName === 'create_quote') {
      const currency =
        typeof execution.resultSummary?.currency === 'string'
          ? execution.resultSummary.currency
          : defaults.currency;
      const estimatedTotal =
        typeof execution.resultSummary?.estimatedTotal === 'number'
          ? execution.resultSummary.estimatedTotal.toFixed(2)
          : defaults.amount;

      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_success_quote',
        variables: {
          currency,
          estimatedTotal,
        },
      });
    }

    if (context.decision.toolName === 'get_product') {
      const name =
        typeof execution.resultSummary?.name === 'string'
          ? execution.resultSummary.name
          : defaults.productName;
      const currency =
        typeof execution.resultSummary?.currency === 'string'
          ? execution.resultSummary.currency
          : defaults.currency;
      const price =
        typeof execution.resultSummary?.price === 'number'
          ? execution.resultSummary.price.toFixed(2)
          : defaults.amount;

      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_success_product',
        variables: {
          name,
          currency,
          price,
        },
      });
    }

    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'execution_success_generic',
    });
  }

  private async buildExecutionFailureResponse(context: ApprovedResponseContext) {
    const toolName = context.decision.toolName;
    const errorCode = context.execution.failure?.code;
    const actionLabel = await this.responseFallbackService.getActionLabel(
      context.locale,
      toolName,
    );

    if (errorCode === 'unknown_tool') {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_failure_unknown_tool',
        variables: {
          actionLabel,
        },
      });
    }

    if (errorCode === 'validation_failed') {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_failure_validation',
        variables: {
          actionLabel,
        },
      });
    }

    if (errorCode === 'not_found') {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_failure_not_found',
        variables: {
          actionLabel,
        },
      });
    }

    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'execution_failure_generic',
      variables: {
        actionLabel,
      },
    });
  }

  private buildVariationSeed(
    context: ApprovedResponseContext,
    templateKey: string,
  ) {
    return [
      context.locale,
      templateKey,
      context.intent,
      context.decision.reasonCode,
      ...(context.missingFields ?? []),
      context.userMessage,
    ]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join('|')
      .toLowerCase();
  }

  private composeWithDocumentSummary(summary: string, trailing: string) {
    if (!trailing.trim()) {
      return summary;
    }

    return `${summary} ${trailing}`.trim();
  }

  private buildConciseDocumentSummary(summary: string) {
    const normalized = summary.trim().replace(/\s+/g, ' ');
    const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim();
    const maxLength = 220;

    if (firstSentence && firstSentence.length <= maxLength) {
      return firstSentence;
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
  }

  private buildMatchBackedDocumentSummary(context: ApprovedResponseContext) {
    const excerpt = context.documentContext?.matches
      .map((match) => match.excerpt?.trim() ?? '')
      .find((value) => value.length > 0);

    return excerpt ? this.buildConciseDocumentSummary(excerpt) : '';
  }

  private buildDocumentGroundingSummary(
    context: ApprovedResponseContext,
    summary: string,
  ) {
    const normalizedSummary = this.buildConciseDocumentSummary(
      context.responseStyle?.preferBrief
        ? this.trimToSingleSentence(summary)
        : summary,
    );
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
      }) ?? '';
    const summarySupportsRequestedDetail =
      !context.documentContext?.grounding.requestedDetailTypes.length ||
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: context.locale,
        summary: normalizedSummary,
        detailTypes: context.documentContext.grounding.requestedDetailTypes,
      });

    if (!groundingClause) {
      return normalizedSummary;
    }

    if (!summarySupportsRequestedDetail) {
      return groundingClause;
    }

    if (normalizedSummary.endsWith(groundingClause)) {
      return normalizedSummary;
    }

    return `${normalizedSummary} ${groundingClause}`.trim();
  }

  private buildCombinedDocumentSummary(
    context: ApprovedResponseContext,
    summary: string,
  ) {
    const conciseSummary = this.buildConciseDocumentSummary(
      context.responseStyle?.preferBrief
        ? this.trimToSingleSentence(summary)
        : summary,
    );
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
      }) ?? '';
    const hasUnsupportedDetails =
      (context.documentContext?.grounding.unsupportedDetailTypes.length ?? 0) > 0;
    const hasSupportedContext =
      (context.documentContext?.grounding.supportedDetailTypes.length ?? 0) > 0 ||
      (context.documentContext?.grounding.partialDetailTypes.length ?? 0) > 0;

    if (hasUnsupportedDetails && groundingClause) {
      return hasSupportedContext && conciseSummary
        ? `${conciseSummary} ${groundingClause}`.trim()
        : groundingClause;
    }

    if (!groundingClause) {
      return conciseSummary;
    }

    if (conciseSummary.endsWith(groundingClause)) {
      return conciseSummary;
    }

    return `${conciseSummary} ${groundingClause}`.trim();
  }

  private trimToSingleSentence(value: string) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim();

    return firstSentence ?? normalized;
  }

  private buildUnavailableKnowledgeResponse(
    context: ApprovedResponseContext,
    fallback: string,
  ) {
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
      }) ?? '';

    return groundingClause || fallback;
  }

  private async applyOpeningGreeting(
    context: ApprovedResponseContext,
    response: string,
  ) {
    if (!context.responseStyle?.includeInitialGreeting) {
      return response;
    }

    const greeting = await this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'opening_greeting',
      variationSeed: this.buildVariationSeed(context, 'opening_greeting'),
    });

    if (!greeting.trim()) {
      return response;
    }

    const normalizedResponse = response.trim();

    if (!normalizedResponse) {
      return greeting;
    }

    const alreadyHasGreeting = await this.responseFallbackService.startsWithGreeting(
      context.locale,
      normalizedResponse,
    );

    if (
      normalizedResponse.startsWith(greeting) ||
      alreadyHasGreeting
    ) {
      return normalizedResponse;
    }

    return `${greeting}\n\n${normalizedResponse}`.trim();
  }

  private applyMultilineLayout(
    context: ApprovedResponseContext,
    response: string,
  ) {
    if (!context.responseStyle?.preferMultiline) {
      return response.trim();
    }

    const paragraphs = response
      .split(/\n{2,}/u)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (paragraphs.length >= 2) {
      return paragraphs.join('\n\n');
    }

    const sentences = response
      .trim()
      .match(/[^.!?]+[.!?]+|[^.!?]+$/gu)
      ?.map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    if (!sentences || sentences.length <= 1) {
      return response.trim();
    }

    const blocks: string[] = [];
    const firstSentence = sentences[0];
    const lastSentence = sentences[sentences.length - 1];
    const hasQuestionTail =
      sentences.length > 1 && /[?¿]\s*$/u.test(lastSentence);
    let bodyStartIndex = 0;
    let bodyEndIndex = sentences.length;

    if (context.responseStyle.includeInitialGreeting) {
      blocks.push(firstSentence);
      bodyStartIndex = 1;
    }

    if (hasQuestionTail) {
      bodyEndIndex -= 1;
    }

    const bodySentences = sentences.slice(bodyStartIndex, bodyEndIndex);

    if (bodySentences.length > 0) {
      blocks.push(bodySentences.join(' '));
    }

    if (hasQuestionTail) {
      blocks.push(lastSentence);
    }

    return blocks.join('\n\n').trim();
  }
}
