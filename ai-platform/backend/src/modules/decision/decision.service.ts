import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { ParsedInterpretation } from '../parsing/parsing.service';
import { DecisionResult } from './decision.types';

@Injectable()
export class DecisionService {
  constructor(private readonly logger: PipelineLoggerService) {}

  decide(input: ParsedInterpretation): DecisionResult {
    const decision = this.resolveDecision(input);

    this.logger.log(
      JSON.stringify({
        stage: 'decision',
        output: decision,
      }),
    );

    return decision;
  }

  private resolveDecision(input: ParsedInterpretation): DecisionResult {
    if (input.confidence < 0.6 || input.intent === 'CLARIFICATION') {
      return {
        domain: 'core',
        action: 'clarify',
        reasonCode: 'low_confidence_or_clarification',
        missingFields: ['user_goal'],
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
}
