import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

import { interpretationResultSchema } from '../../interpretation/interpretation.schemas';
import {
  LanguageModelInterpretationRequest,
  LanguageModelProvider,
  ResponseGenerationInput,
} from '../ai-gateway.types';

type OpenAiProviderInput = {
  apiKey: string;
  model: string;
  timeoutMs: number;
};

@Injectable()
export class OpenAiLanguageModelProvider implements LanguageModelProvider {
  async interpret(
    input: LanguageModelInterpretationRequest,
    providerInput: OpenAiProviderInput,
  ) {
    const client = new OpenAI({
      apiKey: providerInput.apiKey,
      timeout: providerInput.timeoutMs,
    });

    const completion = await client.beta.chat.completions.parse(
      {
        model: providerInput.model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: input.systemPrompt,
          },
          ...input.previousMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          {
            role: 'user',
            content: input.message,
          },
        ],
        response_format: zodResponseFormat(
          interpretationResultSchema,
          'interpretation_output',
        ),
      },
      {
        timeout: providerInput.timeoutMs,
      },
    );

    const parsed = completion.choices[0]?.message.parsed ?? null;
    const rawResponse =
      completion.choices[0]?.message.content ?? JSON.stringify(parsed ?? {});

    return {
      rawResponse,
      model: completion.model ?? providerInput.model,
    };
  }

  async generateResponse(_input: ResponseGenerationInput): Promise<string> {
    return 'Response generation via OpenAI is not enabled in this iteration.';
  }
}
