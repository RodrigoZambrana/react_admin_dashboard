import { Injectable } from '@nestjs/common';

import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import {
  ContinuityMetadata,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import { DecisionResult } from '../decision/decision.types';
import { ParsedInterpretation } from '../parsing/parsing.service';
import { ToolExecutionAttempt } from '../tools/tool.types';
import { ApprovedResponseContextService } from './approved-response-context.service';
import { ChatResponsePolicyService } from './chat-response-policy.service';
import { GeneratedChatResponse } from './response.types';

@Injectable()
export class ChatResponseService {
  constructor(
    private readonly approvedResponseContextService: ApprovedResponseContextService,
    private readonly policyService: ChatResponsePolicyService,
    private readonly aiGatewayService: AiGatewayService,
  ) {}

  async generate(input: {
    message: string;
    interpretation: ParsedInterpretation;
    decision: DecisionResult;
    execution: ToolExecutionAttempt | null;
    continuity: ContinuityMetadata;
    conversationState: ConversationStateSnapshot | null;
  }): Promise<GeneratedChatResponse> {
    const approvedContext = this.approvedResponseContextService.build({
      message: input.message,
      interpretation: input.interpretation,
      decision: input.decision,
      execution: input.execution,
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
    const approvedDraft = this.policyService.resolve(approvedContext);
    const generation = await this.aiGatewayService.generateResponse({
      approvedContext,
      approvedDraft,
    });

    if (generation.ok && generation.parsedResponse) {
      return {
        response: generation.parsedResponse.message,
        approvedContext,
        approvedDraft,
        usedFallback: false,
        generation: {
          provider: generation.provider,
          model: generation.model,
          promptId: generation.promptId,
          promptVersion: generation.promptVersion,
          rawAiResponse: generation.rawResponse,
          parsedJson: generation.parsedResponse,
          error: generation.error,
        },
      };
    }

    return {
      response: approvedDraft,
      approvedContext,
      approvedDraft,
      usedFallback: true,
      generation: {
        provider: generation.provider,
        model: generation.model,
        promptId: generation.promptId,
        promptVersion: generation.promptVersion,
        rawAiResponse: generation.rawResponse,
        parsedJson: generation.parsedResponse,
        error: generation.error,
      },
    };
  }
}
