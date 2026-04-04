import type {
  AiGeneratedResponse,
  ApprovedResponseContext,
} from '../response/response.types';
import type { ResolvedAiRuntimeCredentials } from '../runtime-config/runtime-config.types';

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
  approvedContext: ApprovedResponseContext;
  approvedDraft: string;
  promptTemplate?: string;
};

export type AiGatewayResponseGenerationResult = {
  ok: boolean;
  rawResponse: string | null;
  parsedResponse: AiGeneratedResponse | null;
  error: string | null;
  provider: string;
  model: string | null;
  promptId: string | null;
  promptVersion: number | null;
};

export type LanguageModelProviderConfig = {
  model: string;
  timeoutMs: number;
  credentials: ResolvedAiRuntimeCredentials;
  providerOptions: Record<string, unknown>;
};

export interface LanguageModelProvider {
  interpret(
    input: LanguageModelInterpretationRequest,
    providerInput: LanguageModelProviderConfig,
  ): Promise<{
    rawResponse: string;
    model?: string | null;
  }>;
  generateResponse(
    input: {
      systemPrompt: string;
      approvedContext: ApprovedResponseContext;
      approvedDraft: string;
    },
    providerInput: LanguageModelProviderConfig,
  ): Promise<{
    rawResponse: string;
    model?: string | null;
  }>;
}
