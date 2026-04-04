import { Injectable } from '@nestjs/common';

import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import {
  ContinuityMetadata,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import { DecisionResult } from '../decision/decision.types';
import { DocumentRetrievalResult } from '../documents/document.types';
import { ParsedInterpretation } from '../parsing/parsing.service';
import { ToolExecutionAttempt } from '../tools/tool.types';
import { ApprovedResponseContextService } from './approved-response-context.service';
import { ChatResponsePolicyService } from './chat-response-policy.service';
import { GeneratedChatResponse } from './response.types';
import { ResponseGuardrailService } from './response-guardrail.service';

@Injectable()
export class ChatResponseService {
  constructor(
    private readonly approvedResponseContextService: ApprovedResponseContextService,
    private readonly policyService: ChatResponsePolicyService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly responseGuardrailService: ResponseGuardrailService,
  ) {}

  async generate(input: {
    message: string;
    interpretation: ParsedInterpretation;
    decision: DecisionResult;
    execution: ToolExecutionAttempt | null;
    documentContext: DocumentRetrievalResult | null;
    continuity: ContinuityMetadata;
    conversationState: ConversationStateSnapshot | null;
    abortSignal?: AbortSignal;
  }): Promise<GeneratedChatResponse> {
    const approvedContext = this.approvedResponseContextService.build({
      message: input.message,
      interpretation: input.interpretation,
      decision: input.decision,
      execution: input.execution,
      documentContext: input.documentContext,
      continuity: input.continuity ?? {
        applied: false,
        activeLane: null,
        carriedFactKeys: [],
        invalidatedFactKeys: [],
        missingFields: [],
        previousStateSummary: null,
      },
      conversationState: input.conversationState,
    });
    const approvedDraft = await this.policyService.resolve(approvedContext);
    const generation = await this.aiGatewayService.generateResponse({
      approvedContext,
      approvedDraft,
      abortSignal: input.abortSignal,
    });
    const guardrails =
      generation.ok && generation.parsedResponse
        ? this.responseGuardrailService.evaluate({
            approvedContext,
            approvedDraft,
            generatedResponse: generation.parsedResponse,
          })
        : {
            accepted: false,
            reasons: [],
          };

    if (generation.ok && generation.parsedResponse && guardrails.accepted) {
      return {
        response: generation.parsedResponse.message,
        approvedContext,
        approvedDraft,
        usedFallback: false,
        fallbackReason: null,
        generation: {
          provider: generation.provider,
          model: generation.model,
          promptId: generation.promptId,
          promptVersion: generation.promptVersion,
          rawAiResponse: generation.rawResponse,
          parsedJson: generation.parsedResponse,
          error: generation.error,
          guardrails,
        },
      };
    }

    return {
      response: approvedDraft,
      approvedContext,
      approvedDraft,
      usedFallback: true,
      fallbackReason:
        generation.ok && generation.parsedResponse
          ? 'guardrail_rejected'
          : 'generation_failed',
      generation: {
        provider: generation.provider,
        model: generation.model,
        promptId: generation.promptId,
        promptVersion: generation.promptVersion,
        rawAiResponse: generation.rawResponse,
        parsedJson: generation.parsedResponse,
        error: generation.error,
        guardrails,
      },
    };
  }
}
