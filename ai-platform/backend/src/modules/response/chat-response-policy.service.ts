import { Injectable } from '@nestjs/common';

import { ApprovedResponseContext } from './response.types';

const BASIC_RESPONSE = 'Hello, how can I help you?';

@Injectable()
export class ChatResponsePolicyService {
  resolve(context: ApprovedResponseContext) {
    if (context.outcome === 'clarify') {
      return this.buildClarificationResponse(
        context.missingFields ?? [],
        context.locale,
      );
    }

    if (context.outcome === 'execution_succeeded') {
      return this.buildExecutionSuccessResponse(context);
    }

    if (context.outcome === 'execution_failed') {
      return this.buildExecutionFailureResponse(context);
    }

    return this.buildBasicResponse(context.userMessage, context.locale);
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

    if (missingFields.includes('user_goal')) {
      return isSpanish
        ? 'Necesito entender mejor lo que necesitas para continuar.'
        : 'I need to better understand what you need to continue.';
    }

    return isSpanish
      ? 'Necesito un poco más de contexto para continuar.'
      : 'I need a bit more context to continue.';
  }

  private buildExecutionSuccessResponse(context: ApprovedResponseContext) {
    const isSpanish = this.isSpanish(context.locale);
    const execution = context.execution;

    if (context.decision.toolName === 'create_booking') {
      const scheduledFor =
        typeof execution.resultSummary?.scheduledFor === 'string'
          ? execution.resultSummary.scheduledFor
          : 'the requested date';

      return isSpanish
        ? `La reserva fue confirmada para ${scheduledFor}.`
        : `The booking was confirmed for ${scheduledFor}.`;
    }

    if (context.decision.toolName === 'create_quote') {
      const currency =
        typeof execution.resultSummary?.currency === 'string'
          ? execution.resultSummary.currency
          : 'USD';
      const estimatedTotal =
        typeof execution.resultSummary?.estimatedTotal === 'number'
          ? execution.resultSummary.estimatedTotal.toFixed(2)
          : '0.00';

      return isSpanish
        ? `La cotizacion preliminar fue creada por ${currency} ${estimatedTotal}.`
        : `The preliminary quote was created for ${currency} ${estimatedTotal}.`;
    }

    if (context.decision.toolName === 'get_product') {
      const name =
        typeof execution.resultSummary?.name === 'string'
          ? execution.resultSummary.name
          : 'the requested product';
      const currency =
        typeof execution.resultSummary?.currency === 'string'
          ? execution.resultSummary.currency
          : 'USD';
      const price =
        typeof execution.resultSummary?.price === 'number'
          ? execution.resultSummary.price.toFixed(2)
          : '0.00';

      return isSpanish
        ? `Encontre ${name} por ${currency} ${price}.`
        : `I found ${name} for ${currency} ${price}.`;
    }

    return isSpanish
      ? 'La accion solicitada fue ejecutada correctamente.'
      : 'The requested action was executed successfully.';
  }

  private buildExecutionFailureResponse(context: ApprovedResponseContext) {
    const isSpanish = this.isSpanish(context.locale);
    const toolName = context.decision.toolName;
    const errorCode = context.execution.failure?.code;
    const actionLabel = this.getActionLabel(toolName, context.locale);

    if (errorCode === 'unknown_tool') {
      return isSpanish
        ? `No pude completar ${actionLabel} porque la capacidad aprobada no esta disponible.`
        : `I could not complete ${actionLabel} because the approved capability is not available.`;
    }

    if (errorCode === 'validation_failed') {
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
