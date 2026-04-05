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
    const supportLevel = context.documentContext?.grounding.supportLevel;
    const missingSummaryResponse = await this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'document_not_found',
      variationSeed: this.buildVariationSeed(context, 'document_not_found'),
    });

    if (!groundedSummary || supportLevel === 'unavailable') {
      if (context.outcome === 'clarify') {
        return this.composeWithDocumentSummary(
          missingSummaryResponse,
          await this.buildClarificationResponse(context),
        );
      }

      if (context.outcome === 'execution_succeeded') {
        return this.composeWithDocumentSummary(
          missingSummaryResponse,
          await this.buildExecutionSuccessResponse(context),
        );
      }

      if (context.outcome === 'execution_failed') {
        return this.composeWithDocumentSummary(
          missingSummaryResponse,
          await this.buildExecutionFailureResponse(context),
        );
      }

      return missingSummaryResponse;
    }

    const responseSummary =
      context.documentContext?.responseMode === 'combined_execution'
        ? this.buildCombinedDocumentSummary(context, groundedSummary)
        : this.buildDocumentGroundingSummary(context, groundedSummary);

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

  private buildDocumentGroundingSummary(
    context: ApprovedResponseContext,
    summary: string,
  ) {
    const normalizedSummary = this.buildConciseDocumentSummary(
      context.responseStyle?.incrementalFollowUp
        ? this.trimToSingleSentence(summary)
        : summary,
    );
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
      }) ?? '';

    if (!groundingClause) {
      return normalizedSummary;
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
      context.responseStyle?.incrementalFollowUp
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
}
