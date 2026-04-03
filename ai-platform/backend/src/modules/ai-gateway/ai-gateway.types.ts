export type InterpretationInput = {
  message: string;
  locale?: string;
  promptTemplate?: string;
};

export type InterpretationOutput = {
  intent: string;
  entities: Record<string, unknown>;
  language: string;
  confidence: number;
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
  interpret(input: InterpretationInput): Promise<string>;
  generateResponse(input: ResponseGenerationInput): Promise<string>;
}
