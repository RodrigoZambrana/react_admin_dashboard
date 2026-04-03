import { Injectable } from '@nestjs/common';

import { DecisionResult } from '../decision/decision.types';
import {
  ToolExecutionAttempt,
  ToolExecutionFailure,
  ToolExecutionSuccess,
} from '../tools/tool.types';

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
      return this.buildExecutionAwareResponse(
        input.decision,
        input.execution,
        input.locale,
      );
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
    decision: DecisionResult,
    execution: ToolExecutionAttempt | null,
    locale?: string,
  ) {
    if (!execution) {
      return this.buildExecutionFailureResponse(
        decision.toolName,
        {
          ok: false,
          toolName: decision.toolName ?? 'unknown',
          validatedInput: null,
          errorCode: 'execution_failed',
          errorMessage: 'Execution was not started.',
          durationMs: null,
        },
        locale,
      );
    }

    if (!execution.ok) {
      return this.buildExecutionFailureResponse(
        decision.toolName,
        execution,
        locale,
      );
    }

    return this.buildExecutionSuccessResponse(execution, locale);
  }

  private buildExecutionSuccessResponse(
    execution: ToolExecutionSuccess,
    locale?: string,
  ) {
    const isSpanish = this.isSpanish(locale);

    if (execution.toolName === 'create_booking') {
      const scheduledFor =
        typeof execution.payload.scheduledFor === 'string'
          ? execution.payload.scheduledFor
          : 'the requested date';

      return isSpanish
        ? `La reserva fue confirmada para ${scheduledFor}.`
        : `The booking was confirmed for ${scheduledFor}.`;
    }

    if (execution.toolName === 'create_quote') {
      const currency =
        typeof execution.payload.currency === 'string'
          ? execution.payload.currency
          : 'USD';
      const estimatedTotal =
        typeof execution.payload.estimatedTotal === 'number'
          ? execution.payload.estimatedTotal.toFixed(2)
          : '0.00';

      return isSpanish
        ? `La cotizacion preliminar fue creada por ${currency} ${estimatedTotal}.`
        : `The preliminary quote was created for ${currency} ${estimatedTotal}.`;
    }

    if (execution.toolName === 'get_product') {
      const name =
        typeof execution.payload.name === 'string'
          ? execution.payload.name
          : 'the requested product';
      const currency =
        typeof execution.payload.currency === 'string'
          ? execution.payload.currency
          : 'USD';
      const price =
        typeof execution.payload.price === 'number'
          ? execution.payload.price.toFixed(2)
          : '0.00';

      return isSpanish
        ? `Encontre ${name} por ${currency} ${price}.`
        : `I found ${name} for ${currency} ${price}.`;
    }

    return isSpanish
      ? 'La accion solicitada fue ejecutada correctamente.'
      : 'The requested action was executed successfully.';
  }

  private buildExecutionFailureResponse(
    toolName: string | undefined,
    execution: ToolExecutionFailure,
    locale?: string,
  ) {
    const isSpanish = this.isSpanish(locale);
    const actionLabel = this.getActionLabel(toolName, locale);

    if (execution.errorCode === 'unknown_tool') {
      return isSpanish
        ? `No pude completar ${actionLabel} porque la capacidad aprobada no esta disponible.`
        : `I could not complete ${actionLabel} because the approved capability is not available.`;
    }

    if (execution.errorCode === 'validation_failed') {
      return isSpanish
        ? `No pude completar ${actionLabel} con la informacion disponible.`
        : `I could not complete ${actionLabel} with the available information.`;
    }

    return isSpanish
      ? `No pude completar ${actionLabel} por un error durante la ejecucion.`
      : `I could not complete ${actionLabel} because of an execution error.`;
  }

  private getActionLabel(toolName: string | undefined, locale?: string) {
    const isSpanish = this.isSpanish(locale);

    if (toolName === 'create_booking') {
      return isSpanish ? 'la reserva solicitada' : 'the requested booking';
    }

    if (toolName === 'create_quote') {
      return isSpanish ? 'la cotizacion solicitada' : 'the requested quote';
    }

    if (toolName === 'get_product') {
      return isSpanish
        ? 'la consulta de producto solicitada'
        : 'the requested product lookup';
    }

    return isSpanish ? 'la solicitud aprobada' : 'the approved request';
  }

  private isSpanish(locale?: string) {
    return (locale ?? '').toLowerCase().startsWith('es');
  }
}
