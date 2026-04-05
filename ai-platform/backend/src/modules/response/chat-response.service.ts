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
import { AiGeneratedResponse, GeneratedChatResponse } from './response.types';
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

    if (approvedContext.responseStyle?.groundedKnowledgeOnly) {
      return {
        response: approvedDraft,
        approvedContext,
        approvedDraft,
        usedFallback: true,
        fallbackReason: 'policy_locked',
        generation: {
          provider: 'policy',
          model: null,
          promptId: null,
          promptVersion: null,
          rawAiResponse: null,
          parsedJson: null,
          error: null,
          guardrails: {
            accepted: true,
            reasons: [],
          },
        },
      };
    }

    const generation = await this.aiGatewayService.generateResponse({
      approvedContext,
      approvedDraft,
      abortSignal: input.abortSignal,
    });
    const normalizedParsedResponse =
      generation.ok && generation.parsedResponse
        ? this.normalizeGeneratedResponseReferences({
            approvedContext,
            generatedResponse: generation.parsedResponse,
          })
        : generation.parsedResponse;
    const guardrails =
      generation.ok && normalizedParsedResponse
        ? this.responseGuardrailService.evaluate({
            approvedContext,
            approvedDraft,
            generatedResponse: normalizedParsedResponse,
          })
        : {
            accepted: false,
            reasons: [],
          };

    if (generation.ok && normalizedParsedResponse && guardrails.accepted) {
      const response = await this.formatFinalResponse({
        message: normalizedParsedResponse.message,
        approvedContext,
        approvedDraft,
      });

      return {
        response,
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
          parsedJson: normalizedParsedResponse,
          error: generation.error,
          guardrails,
        },
      };
    }

    return {
      response: await this.formatFinalResponse({
        message: approvedDraft,
        approvedContext,
        approvedDraft,
      }),
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
        parsedJson: normalizedParsedResponse,
        error: generation.error,
        guardrails,
      },
    };
  }

  private async formatFinalResponse(input: {
    message: string;
    approvedContext: GeneratedChatResponse['approvedContext'];
    approvedDraft: string;
  }) {
    const normalizedMessage = input.message.trim();

    if (!normalizedMessage) {
      return normalizedMessage;
    }

    const responseStyle = input.approvedContext.responseStyle;
    const greetingBlock =
      responseStyle?.includeInitialGreeting
        ? this.extractOpeningGreeting(input.approvedDraft)
        : null;
    const hasDraftGreetingPrefix =
      Boolean(greetingBlock) && normalizedMessage.startsWith(greetingBlock!);
    const bodyMessage = hasDraftGreetingPrefix
      ? normalizedMessage.slice(greetingBlock!.length).trim()
      : normalizedMessage;
    const shouldMultiline =
      responseStyle?.preferMultiline ||
      (responseStyle?.includeInitialGreeting && bodyMessage.length > 0);

    if (!shouldMultiline) {
      return normalizedMessage;
    }

    const blocks: string[] = [];

    if (greetingBlock) {
      blocks.push(greetingBlock);
    }

    const bodyBlocks = this.splitResponseIntoBlocks(bodyMessage, {
      splitFirstSentence: false,
    });

    for (const block of bodyBlocks) {
      if (block.length > 0) {
        blocks.push(block);
      }
    }

    if (blocks.length === 0) {
      return normalizedMessage;
    }

    return blocks.join('\n\n').trim();
  }

  private extractOpeningGreeting(approvedDraft: string) {
    const firstParagraph = approvedDraft
      .split(/\n{2,}/u)
      .map((part) => part.trim())
      .find((part) => part.length > 0);

    return firstParagraph?.length ? firstParagraph : null;
  }

  private splitResponseIntoBlocks(
    value: string,
    options?: {
      splitFirstSentence?: boolean;
    },
  ) {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    const existingBlocks = trimmed
      .split(/\n{2,}/u)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (existingBlocks.length >= 2) {
      return existingBlocks;
    }

    const sentences = trimmed
      .match(/[^.!?]+[.!?]+|[^.!?]+$/gu)
      ?.map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    if (!sentences || sentences.length <= 1) {
      return [trimmed];
    }

    const blocks: string[] = [];
    const lastSentence = sentences[sentences.length - 1];
    const hasQuestionTail =
      sentences.length > 1 && /[?¿]\s*$/u.test(lastSentence);
    const informationalSentences = hasQuestionTail
      ? sentences.slice(0, -1)
      : [...sentences];

    if (options?.splitFirstSentence && informationalSentences.length > 1) {
      blocks.push(informationalSentences.shift()!);
    }

    if (informationalSentences.length > 0) {
      blocks.push(informationalSentences.join(' '));
    }

    if (hasQuestionTail) {
      blocks.push(lastSentence);
    }

    return blocks;
  }

  private normalizeGeneratedResponseReferences(input: {
    approvedContext: GeneratedChatResponse['approvedContext'];
    generatedResponse: AiGeneratedResponse;
  }): AiGeneratedResponse {
    const { approvedContext, generatedResponse } = input;

    return {
      ...generatedResponse,
      mentionedMissingFields: this.intersectWithApproved(
        generatedResponse.mentionedMissingFields,
        approvedContext.missingFields ?? [],
      ),
      mentionedApprovedFactKeys: this.intersectWithApproved(
        generatedResponse.mentionedApprovedFactKeys,
        approvedContext.approvedFactKeys,
      ),
      mentionedApprovedResultKeys: this.intersectWithApproved(
        generatedResponse.mentionedApprovedResultKeys,
        approvedContext.approvedResultKeys,
      ),
      mentionedDocumentIds: this.intersectWithApproved(
        generatedResponse.mentionedDocumentIds,
        approvedContext.approvedDocumentIds,
      ),
    };
  }

  private intersectWithApproved(
    candidate: string[] | undefined,
    approved: string[] | undefined,
  ) {
    if (!candidate?.length || !approved?.length) {
      return [];
    }

    const allowed = new Set(approved);
    return candidate.filter((value) => allowed.has(value));
  }
}
