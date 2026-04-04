import { Injectable } from '@nestjs/common';

import {
  AiGeneratedResponse,
  ApprovedResponseContext,
  ResponseGuardrailCode,
  ResponseGuardrailResult,
} from './response.types';

@Injectable()
export class ResponseGuardrailService {
  evaluate(input: {
    approvedContext: ApprovedResponseContext;
    generatedResponse: AiGeneratedResponse;
  }): ResponseGuardrailResult {
    const reasons = new Set<ResponseGuardrailCode>();
    const { approvedContext, generatedResponse } = input;

    if (generatedResponse.assertedOutcome !== approvedContext.outcome) {
      reasons.add('outcome_mismatch');
    }

    if (
      generatedResponse.assertedExecutionStatus !== approvedContext.execution.status
    ) {
      reasons.add('execution_status_mismatch');
    }

    if (
      !this.isSubset(
        generatedResponse.mentionedMissingFields,
        approvedContext.missingFields ?? [],
      )
    ) {
      reasons.add('unsupported_missing_fields');
    }

    if (
      !this.isSubset(
        generatedResponse.mentionedApprovedFactKeys,
        approvedContext.approvedFactKeys,
      )
    ) {
      reasons.add('unsupported_fact_keys');
    }

    if (
      !this.isSubset(
        generatedResponse.mentionedApprovedResultKeys,
        approvedContext.approvedResultKeys,
      )
    ) {
      reasons.add('unsupported_result_keys');
    }

    return {
      accepted: reasons.size === 0,
      reasons: Array.from(reasons.values()),
    };
  }

  private isSubset(candidate: string[], supported: string[]) {
    const allowed = new Set(supported);
    return candidate.every((value) => allowed.has(value));
  }
}
