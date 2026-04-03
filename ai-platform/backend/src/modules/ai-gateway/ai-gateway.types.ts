export type ConversationContextMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type InterpretationInput = {
  message: string;
  locale?: string;
  promptTemplate?: string;
  previousMessages?: ConversationContextMessage[];
};

export type InterpretationOutput = {
  intent: string;
  entities: Record<string, unknown>;
  language: string;
  confidence: number;
};

export type AiGatewayInterpretationResult = {
  ok: boolean;
  rawResponse: string | null;
  parsedResponse: InterpretationOutput | null;
  error: string | null;
  provider: string;
  model: string | null;
};

export type LanguageModelInterpretationRequest = {
  systemPrompt: string;
  message: string;
  locale?: string;
  previousMessages: ConversationContextMessage[];
};

export type ResponseGenerationInput = {
  message: string;
  intent: string;
  toolResult?: Record<string, unknown> | null;
  language: string;
  promptTemplate?: string;
  responseTemplateKey?: string;
  missingFields?: string[];
};

export interface LanguageModelProvider {
  interpret(
    input: LanguageModelInterpretationRequest,
    providerInput: {
      apiKey: string;
      model: string;
      timeoutMs: number;
    },
  ): Promise<{
    rawResponse: string;
    model?: string | null;
  }>;
  generateResponse(input: ResponseGenerationInput): Promise<string>;
}
