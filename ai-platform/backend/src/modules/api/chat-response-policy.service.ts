import { Injectable } from '@nestjs/common';

import { DecisionResult } from '../decision/decision.types';
import { ToolExecutionAttempt } from '../tools/tool.types';

const BASIC_RESPONSE = 'Hello, how can I help you?';

@Injectable()
export class ChatResponsePolicyService {
  resolve(input: {
    decision: DecisionResult;
    locale?: string;
    message: string;
    execution: ToolExecutionAttempt | null;
  }) {
    if (input.decision.action === 'clarify') {
      return this.buildClarificationResponse(
        input.decision.missingFields,
        input.locale,
      );
    }

    if (input.decision.action === 'invoke_tool') {
      return this.buildExecutionAwareResponse(input.execution, input.locale);
    }

    return this.buildBasicResponse(input.message, input.locale);
  }

  private buildBasicResponse(message: string, locale?: string) {
    const normalized = `${locale ?? ''} ${message}`.toLowerCase();

    if (normalized.includes('hola') || normalized.includes('hello')) {
      return BASIC_RESPONSE;
    }

    return BASIC_RESPONSE;
  }

  private buildClarificationResponse(missingFields: string[], locale?: string) {
    const isSpanish = this.isSpanish(locale);

    if (missingFields.includes('requested_date')) {
      return isSpanish
        ? 'Necesito la fecha deseada para continuar.'
        : 'I need the requested date to continue.';
    }

    return isSpanish
      ? 'Necesito un poco más de contexto para continuar.'
      : 'I need a bit more context to continue.';
  }

  private buildExecutionAwareResponse(
    execution: ToolExecutionAttempt | null,
    locale?: string,
  ) {
    const isSpanish = this.isSpanish(locale);

    if (!execution || !execution.ok) {
      return isSpanish
        ? 'No pude completar la accion solicitada con la informacion disponible.'
        : 'I could not complete the requested action with the available information.';
    }

    return isSpanish
      ? 'Listo. La accion solicitada fue procesada correctamente.'
      : 'Done. The requested action was processed successfully.';
  }

  private isSpanish(locale?: string) {
    return (locale ?? '').toLowerCase().startsWith('es');
  }
}
