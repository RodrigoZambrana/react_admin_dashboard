import { Injectable } from '@nestjs/common';

import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import {
  ContinuityMetadata,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import { DecisionResult } from '../decision/decision.types';
import { DocumentRetrievalResult } from '../documents/document.types';
import { ParsedInterpretation } from '../parsing/parsing.service';
import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
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
    private readonly responseFallbackService: ResponseFallbackService,
  ) {}

  async generate(input: {
    message: string;
    interpretation: ParsedInterpretation;
    decision: DecisionResult;
    execution: ToolExecutionAttempt | null;
    documentContext: DocumentRetrievalResult | null;
    continuity: ContinuityMetadata;
    conversationState: ConversationStateSnapshot | null;
    hasPriorMessages?: boolean;
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
      hasPriorMessages: input.hasPriorMessages,
    });
    const approvedDraft = await this.policyService.resolve(approvedContext);

    if (approvedContext.outcome === 'close_turn') {
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

    if (shouldLockScopedKnowledgeDraft(approvedContext, approvedDraft)) {
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
        ? await this.responseGuardrailService.evaluate({
            approvedContext,
            approvedDraft,
            generatedResponse: normalizedParsedResponse,
          })
        : {
            accepted: false,
            reasons: [],
          };
    const repairedGeneration =
      generation.ok && normalizedParsedResponse
        ? await this.tryRepairGuardrailRejection({
            approvedContext,
            approvedDraft,
            generatedResponse: normalizedParsedResponse,
            guardrails,
          })
        : null;
    const effectiveGeneratedResponse =
      repairedGeneration?.generatedResponse ?? normalizedParsedResponse;
    const effectiveGuardrails = repairedGeneration?.guardrails ?? guardrails;

    if (
      generation.ok &&
      effectiveGeneratedResponse &&
      effectiveGuardrails.accepted
    ) {
      const response = await this.formatFinalResponse({
        message: effectiveGeneratedResponse.message,
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
          parsedJson: effectiveGeneratedResponse,
          error: generation.error,
          guardrails: effectiveGuardrails,
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
        parsedJson: effectiveGeneratedResponse,
        error: generation.error,
        guardrails: effectiveGuardrails,
      },
    };
  }

  private async tryRepairGuardrailRejection(input: {
    approvedContext: GeneratedChatResponse['approvedContext'];
    approvedDraft: string;
    generatedResponse: AiGeneratedResponse;
    guardrails: GeneratedChatResponse['generation']['guardrails'];
  }) {
    if (input.guardrails.accepted) {
      return null;
    }

    let candidateMessage = input.generatedResponse.message;
    let changed = false;
    const greetingRelatedReasons = new Set<string>([
      'duplicate_opening_greeting',
      'unexpected_followup_greeting',
    ]);

    if (
      input.guardrails.reasons.some((reason) => greetingRelatedReasons.has(reason))
    ) {
      const strippedGreeting = await stripStandaloneGreeting({
        locale: input.approvedContext.locale,
        value: candidateMessage,
        approvedDraft: input.approvedDraft,
        responseFallbackService: this.responseFallbackService,
      });

      if (strippedGreeting && strippedGreeting !== candidateMessage.trim()) {
        candidateMessage = strippedGreeting;
        changed = true;
      }
    }

    if (!changed) {
      return null;
    }

    const generatedResponse = {
      ...input.generatedResponse,
      message: candidateMessage,
    };
    const guardrails = await this.responseGuardrailService.evaluate({
      approvedContext: input.approvedContext,
      approvedDraft: input.approvedDraft,
      generatedResponse,
    });

    return {
      generatedResponse,
      guardrails,
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

function shouldLockScopedKnowledgeDraft(
  context: ReturnType<ApprovedResponseContextService['build']>,
  approvedDraft: string,
) {
  if (
    context.outcome !== 'respond' ||
    !context.responseStyle?.incrementalFollowUp ||
    context.documentContext?.grounding.supportLevel !== 'explicit' ||
    (context.documentContext?.grounding.unsupportedDetailTypes.length ?? 0) > 0
  ) {
    return false;
  }

  const scopedCostLocation = (context.documentContext?.matches ?? [])
    .flatMap((match) => match.supportSummary?.axisSummaries ?? [])
    .find(
      (claim) =>
        claim.axis === 'commercial_visit_cost' &&
        claim.supportClass === 'explicit_fact' &&
        (claim.appliesTo ?? []).some((scope) => scope.axis === 'location'),
    )
    ?.appliesTo?.find((scope) => scope.axis === 'location')?.value;

  if (!scopedCostLocation) {
    return false;
  }

  if (
    /:\s+/u.test(approvedDraft) ||
    /location relation/iu.test(approvedDraft) ||
    /payment method/iu.test(approvedDraft)
  ) {
    return false;
  }

  return approvedDraft.includes(scopedCostLocation);
}

async function stripStandaloneGreeting(input: {
  locale: string | null | undefined;
  value: string;
  approvedDraft: string;
  responseFallbackService: ResponseFallbackService;
}) {
  const trimmed = input.value.trim();
  const greetingCue = extractGreetingCue(input.approvedDraft);

  if (
    !trimmed ||
    !greetingCue ||
    !(await startsWithGreetingCue({
      locale: input.locale,
      value: trimmed,
      greetingCue,
      responseFallbackService: input.responseFallbackService,
    }))
  ) {
    return trimmed;
  }

  const paragraphs = trimmed
    .split(/\n{2,}/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (
    paragraphs.length >= 2 &&
    (await startsWithGreetingCue({
      locale: input.locale,
      value: paragraphs[0],
      greetingCue,
      responseFallbackService: input.responseFallbackService,
    }))
  ) {
    return paragraphs.slice(1).join('\n\n').trim();
  }

  const sentences = trimmed
    .match(/[^.!?]+[.!?]+|[^.!?]+$/gu)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences && sentences.length > 1) {
    if (
      await startsWithGreetingCue({
        locale: input.locale,
        value: sentences[0],
        greetingCue,
        responseFallbackService: input.responseFallbackService,
      })
    ) {
      return sentences.slice(1).join(' ').trim();
    }
  }

  const inlineGreetingStripped = stripGreetingLeadSegment(trimmed, greetingCue);

  if (inlineGreetingStripped && inlineGreetingStripped !== trimmed) {
    return inlineGreetingStripped;
  }

  return trimmed;
}

async function startsWithGreetingCue(input: {
  locale: string | null | undefined;
  value: string;
  greetingCue: string;
  responseFallbackService: ResponseFallbackService;
}) {
  const normalizedValue = input.value.trim();

  if (!normalizedValue) {
    return false;
  }

  if (
    await input.responseFallbackService.startsWithGreeting(
      input.locale,
      normalizedValue,
    )
  ) {
    return true;
  }

  return normalizeCue(normalizedValue).startsWith(normalizeCue(input.greetingCue));
}

function extractGreetingCue(approvedDraft: string) {
  const firstParagraph = approvedDraft
    .split(/\n{2,}/u)
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  if (!firstParagraph) {
    return '';
  }

  const separatorIndex = findLeadingSeparatorIndex(firstParagraph);

  if (separatorIndex > 0) {
    return firstParagraph.slice(0, separatorIndex).trim();
  }

  return firstParagraph.split(/\s+/u).slice(0, 2).join(' ').trim();
}

function stripGreetingLeadSegment(value: string, greetingCue: string) {
  const separatorIndex = findLeadingSeparatorIndex(value);

  if (separatorIndex <= 0) {
    return value;
  }

  const leadSegment = value.slice(0, separatorIndex).trim();

  if (!normalizeCue(leadSegment).startsWith(normalizeCue(greetingCue))) {
    return value;
  }

  return normalizeSentenceStart(value.slice(separatorIndex + 1).trim());
}

function findLeadingSeparatorIndex(value: string) {
  const limit = Math.min(value.length, 48);

  for (let index = 0; index < limit; index += 1) {
    if (',.:;-!?'.includes(value[index])) {
      return index;
    }
  }

  return -1;
}

function normalizeCue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .trim();
}

function normalizeSentenceStart(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}
