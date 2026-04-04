import { Injectable } from '@nestjs/common';

import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import { ApprovedResponseContext } from './response.types';

@Injectable()
export class ChatResponsePolicyService {
  constructor(
    private readonly responseFallbackService: ResponseFallbackService,
  ) {}

  async resolve(context: ApprovedResponseContext) {
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

    if (!groundedSummary) {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'document_not_found',
        variationSeed: this.buildVariationSeed(context, 'document_not_found'),
      });
    }

    if (context.outcome === 'clarify') {
      return this.composeWithDocumentSummary(
        groundedSummary,
        await this.buildClarificationResponse(context),
      );
    }

    if (context.outcome === 'execution_succeeded') {
      return this.composeWithDocumentSummary(
        groundedSummary,
        await this.buildExecutionSuccessResponse(context),
      );
    }

    if (context.outcome === 'execution_failed') {
      return this.composeWithDocumentSummary(
        groundedSummary,
        await this.buildExecutionFailureResponse(context),
      );
    }

    return groundedSummary;
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
}
