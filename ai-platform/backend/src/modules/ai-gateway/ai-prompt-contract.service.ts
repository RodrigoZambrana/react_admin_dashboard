import { Injectable } from '@nestjs/common';

@Injectable()
export class AiPromptContractService {
  buildInterpretationContract() {
    return [
      'Backend-owned interpretation contract:',
      '- Return JSON only.',
      '- Required keys: intent, entities, language, confidence.',
      '- Allowed intents: GENERAL_CONVERSATION, CLARIFICATION, GET_PRODUCT, CREATE_BOOKING, CREATE_QUOTE.',
      '- entities must always be a JSON object.',
      '- language must be a short language code such as "es" or "en".',
      '- confidence must be a number between 0 and 1.',
      '- Do not execute tools.',
      '- Do not make business decisions.',
    ];
  }

  buildResponseContract() {
    return [
      'Backend-owned response contract:',
      '- You will receive approved backend context as JSON.',
      '- You will receive an approved deterministic fallback draft.',
      '- Do not invent tool executions, business facts, missing fields, or continuity state.',
      '- Do not hide failures or uncertainty.',
      '- Keep the meaning grounded in approved backend context only.',
      '- Return JSON only with:',
      '  - message: string',
      '  - assertedOutcome: respond | clarify | execution_succeeded | execution_failed',
      '  - assertedExecutionStatus: not_applicable | succeeded | failed',
      '  - mentionedMissingFields: string[]',
      '  - mentionedApprovedFactKeys: string[]',
      '  - mentionedApprovedResultKeys: string[]',
    ];
  }
}
