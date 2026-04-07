import { Injectable } from '@nestjs/common';

import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import { splitGroundingSentences } from './response-grounding.catalogs';
import {
  AiGeneratedResponse,
  ApprovedResponseContext,
  ResponseGuardrailCode,
  ResponseGuardrailResult,
} from './response.types';
import { ResponseGroundingService } from './response-grounding.service';

@Injectable()
export class ResponseGuardrailService {
  constructor(
    private readonly responseGroundingService: ResponseGroundingService,
    private readonly responseFallbackService: ResponseFallbackService,
  ) {}

  async evaluate(input: {
    approvedContext: ApprovedResponseContext;
    approvedDraft?: string;
    generatedResponse: AiGeneratedResponse;
  }): Promise<ResponseGuardrailResult> {
    const reasons = new Set<ResponseGuardrailCode>();
    const { approvedContext, approvedDraft, generatedResponse } = input;

    if (generatedResponse.assertedOutcome !== approvedContext.outcome) {
      reasons.add('outcome_mismatch');
    }

    if (
      approvedContext.outcome === 'close_turn' &&
      this.responseGroundingService.containsCloseTurnReopenCue({
        locale: approvedContext.locale,
        message: generatedResponse.message,
      })
    ) {
      reasons.add('close_turn_reopen');
    }

    if (
      this.shouldEnforceExecutionStatus(approvedContext) &&
      generatedResponse.assertedExecutionStatus !== approvedContext.execution.status
    ) {
      reasons.add('execution_status_mismatch');
    }

    if (
      approvedContext.responseStyle?.includeInitialGreeting &&
      (await this.startsWithStandaloneGreeting(
        approvedContext.locale,
        generatedResponse.message,
      ))
    ) {
      reasons.add('duplicate_opening_greeting');
    }

    if (
      !approvedContext.responseStyle?.includeInitialGreeting &&
      approvedContext.responseStyle?.hasPriorConversation &&
      (await this.startsWithStandaloneGreeting(
        approvedContext.locale,
        generatedResponse.message,
      ))
    ) {
      reasons.add('unexpected_followup_greeting');
    }

    if (
      !this.isSubset(
        generatedResponse.mentionedMissingFields,
        approvedContext.missingFields ?? [],
      )
    ) {
      reasons.add('unsupported_missing_fields');
    }

    if (
      !this.isSubset(
        generatedResponse.mentionedApprovedFactKeys,
        approvedContext.approvedFactKeys,
      )
    ) {
      reasons.add('unsupported_fact_keys');
    }

    if (
      !this.isSubset(
        generatedResponse.mentionedApprovedResultKeys,
        approvedContext.approvedResultKeys,
      )
    ) {
      reasons.add('unsupported_result_keys');
    }

    if (
      !this.isSubset(
        generatedResponse.mentionedDocumentIds,
        approvedContext.approvedDocumentIds,
      )
    ) {
      reasons.add('unsupported_document_ids');
    }

    const documentGrounding = approvedContext.documentContext?.grounding;

    if (documentGrounding) {
      const claimedDetailTypes = this.responseGroundingService.extractClaimedDetailTypes({
        locale: approvedContext.locale,
        message: generatedResponse.message,
        documentContext: approvedContext.documentContext,
      });
      const sentenceAnalyses = splitGroundingSentences(
        generatedResponse.message,
      ).map((sentence) => {
        const hasUnspecifiedCue =
          this.responseGroundingService.containsUnspecifiedCue({
            locale: approvedContext.locale,
            message: sentence,
          });

        return {
          sentence,
          hasUnspecifiedCue,
          claimedDetailTypes: this.responseGroundingService.extractClaimedDetailTypes({
            locale: approvedContext.locale,
            message: sentence,
            documentContext: approvedContext.documentContext,
          }),
        };
      });
      const unspecifiedDetailTypes = sentenceAnalyses
        .filter((analysis) => analysis.hasUnspecifiedCue)
        .flatMap((analysis) => analysis.claimedDetailTypes);
      const messageContainsUnspecifiedCue =
        this.responseGroundingService.containsUnspecifiedCue({
          locale: approvedContext.locale,
          message: generatedResponse.message,
        });
      const allowedUnspecifiedDetailTypes = new Set(
        documentGrounding.requiredUnspecifiedDetailTypes ??
          [
            ...(
              documentGrounding.exactnessRequested
                ? documentGrounding.partialDetailTypes
                : []
            ),
            ...documentGrounding.unsupportedDetailTypes,
          ],
      );
      const resolvedRequiredDetailTypes = new Set(
        [...allowedUnspecifiedDetailTypes].filter(
          (detailType) =>
            unspecifiedDetailTypes.includes(detailType) ||
            this.responseGroundingService.summaryContainsConcreteDetail({
              locale: approvedContext.locale,
              detailType,
              summary: generatedResponse.message,
              documentContext: approvedContext.documentContext,
            }),
        ),
      );

      if (
        allowedUnspecifiedDetailTypes.size > 0 &&
        resolvedRequiredDetailTypes.size === 0
      ) {
        reasons.add('missing_required_detail_axis');
      }

      if (
        unspecifiedDetailTypes.some(
          (detailType) => !allowedUnspecifiedDetailTypes.has(detailType),
        )
      ) {
        reasons.add('wrong_unspecified_detail_axis');
      }

      if (
        documentGrounding.absenceReason === 'extraction_uncertain' &&
        messageContainsUnspecifiedCue &&
        unspecifiedDetailTypes.some((detailType) =>
          allowedUnspecifiedDetailTypes.has(detailType),
        )
      ) {
        reasons.add('unsupported_document_absence_claim');
      }

      if (
        sentenceAnalyses.some((analysis) => {
          if (analysis.hasUnspecifiedCue) {
            return false;
          }

          const unresolvedUnsupportedDetail = analysis.claimedDetailTypes.some(
            (detailType) =>
              documentGrounding.unsupportedDetailTypes.includes(detailType) &&
              !this.responseGroundingService.summaryContainsConcreteDetail({
                locale: approvedContext.locale,
                detailType,
                summary: analysis.sentence,
                documentContext: approvedContext.documentContext,
              }),
          );

          if (!unresolvedUnsupportedDetail) {
            return false;
          }

          return true;
        }) &&
        !messageContainsUnspecifiedCue
      ) {
        reasons.add('unsupported_document_detail');
      }

      if (
        documentGrounding.partialDetailTypes.length > 0 &&
        documentGrounding.exactnessRequested &&
        claimedDetailTypes.some((detailType) =>
          documentGrounding.partialDetailTypes.includes(detailType),
        ) &&
        !messageContainsUnspecifiedCue
      ) {
        reasons.add('partial_document_detail_overclaim');
      }

      if (
        approvedContext.outcome === 'respond' &&
        !reasons.has('unsupported_document_detail') &&
        !reasons.has('partial_document_detail_overclaim') &&
        !reasons.has('missing_required_detail_axis') &&
        !reasons.has('wrong_unspecified_detail_axis') &&
        this.responseGroundingService.hasDocumentContextOverreach({
          approvedContext,
          approvedDraft,
          message: generatedResponse.message,
        })
      ) {
        reasons.add('document_context_overreach');
      }
    }

    return {
      accepted: reasons.size === 0,
      reasons: Array.from(reasons.values()),
    };
  }

  private isSubset(candidate: string[], supported: string[]) {
    const allowed = new Set(supported);
    return candidate.every((value) => allowed.has(value));
  }

  private shouldEnforceExecutionStatus(approvedContext: ApprovedResponseContext) {
    return (
      approvedContext.outcome === 'execution_succeeded' ||
      approvedContext.outcome === 'execution_failed'
    );
  }

  private async startsWithStandaloneGreeting(
    locale: string | null | undefined,
    value: string,
  ) {
    const normalized = value.trim();

    if (!normalized) {
      return false;
    }

    const firstSentence = normalized
      .split(/(?<=[.!?])\s+/u)
      .map((sentence) => sentence.trim())
      .find((sentence) => sentence.length > 0);

    if (!firstSentence) {
      return false;
    }

    return this.responseFallbackService.startsWithGreeting(locale, firstSentence);
  }
}
