import { Injectable } from '@nestjs/common';

import { ContinuityAwareInterpretation } from '../continuity/continuity.types';
import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { DecisionResult } from './decision.types';

@Injectable()
export class DecisionService {
  constructor(private readonly logger: PipelineLoggerService) {}

  decide(input: ContinuityAwareInterpretation): DecisionResult {
    const decision = this.resolveDecision(input);

    this.logger.log(
      JSON.stringify({
        stage: 'decision',
        output: decision,
      }),
    );

    return decision;
  }

  private resolveDecision(input: ContinuityAwareInterpretation): DecisionResult {
    const continuityApplied = input.continuity?.applied === true;
    const continuityMissingFields = this.resolveContinuityMissingFields(input);

    if (
      !continuityApplied &&
      (input.confidence < 0.6 || input.intent === 'CLARIFICATION')
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

    if (input.intent === 'CREATE_BOOKING') {
      const missingFields = input.normalizedEntities.dates.length
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

    if (input.intent === 'GET_PRODUCT') {
      return {
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'get_product',
        reasonCode: 'product_lookup_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.ecommerce.product_result',
      };
    }

    if (input.intent === 'CREATE_QUOTE') {
      return {
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'create_quote',
        reasonCode: 'quote_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.quote.confirmation',
      };
    }

    return {
      domain: 'core',
      action: 'respond',
      reasonCode: 'general_conversation',
      missingFields: [],
      responseTemplateKey: 'core.general_response',
    };
  }

  private resolveContinuityMissingFields(input: ContinuityAwareInterpretation) {
    if (!input.continuity?.activeLane) {
      return [];
    }

    const continuityFields = input.continuity.missingFields.filter(
      (value) => value.trim().length > 0,
    );

    if (continuityFields.length > 0) {
      return continuityFields;
    }

    if (
      input.continuity.nextUsefulField &&
      input.continuity.nextUsefulField.trim().length > 0
    ) {
      return [input.continuity.nextUsefulField];
    }

    return [];
  }
}
