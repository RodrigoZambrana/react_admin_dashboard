import { Injectable } from '@nestjs/common';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import {
  AsyncIntakeLexicon,
  AsyncIntakeRuntimeResource,
  buildDefaultAsyncIntakeRuntimeResource,
} from '../critical-config/critical-config.types';

const COMPLETED_SENTENCE_REGEX = /[.!?…]$/u;
const QUESTION_REGEX = /[?¿]$/u;

@Injectable()
export class AsyncTurnTimingPolicyService {
  constructor(
    private readonly criticalConfigService: CriticalConfigService,
  ) {}

  buildSemanticInput(messages: string[]) {
    return messages
      .map((message) => this.normalizeText(message))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  async estimateReplyDelay(response: string) {
    const config = await this.getConfig();
    const normalized = this.normalizeText(response);

    if (!normalized) {
      return 0;
    }

    const { minDelayMs, maxDelayMs, charDelayMs } = config.replyProjection;
    const perChar = Math.min(
      normalized.length * charDelayMs,
      Math.max(maxDelayMs - minDelayMs, 0),
    );

    return Math.min(minDelayMs + perChar, maxDelayMs);
  }

  async calculateFlushAt(input: {
    acceptedAt: Date;
    messages: string[];
    locale?: string | null;
  }) {
    const config = await this.getConfig();
    const stabilizationDelayMs = this.estimateStabilizationDelay(
      input.messages,
      input.locale,
      config,
    );
    const maxWindowDeadline = new Date(
      input.acceptedAt.getTime() + config.stabilization.maxWindowMs,
    );
    const desiredFlushAt = new Date(Date.now() + stabilizationDelayMs);

    return {
      stabilizationDelayMs,
      flushAt:
        desiredFlushAt.getTime() > maxWindowDeadline.getTime()
          ? maxWindowDeadline
          : desiredFlushAt,
    };
  }

  async estimateTypingQuietPeriod(input?: {
    locale?: string | null;
    responseProgressActive?: boolean;
  }) {
    const config = await this.getConfig();
    const lexicon = this.resolveLexicon(config, input?.locale);
    const baseQuietWindow = Math.max(
      config.stabilization.shortMessageDelayMs,
      Math.min(config.stabilization.fragmentContinuationDelayMs, 1600),
    );
    const responsePauseFloor = input?.responseProgressActive ? 2200 : 0;
    const quietWindowFloor = Math.max(baseQuietWindow, responsePauseFloor);

    if (lexicon.trailingTokens.length > 0 || lexicon.slotPatterns.length > 0) {
      return quietWindowFloor;
    }

    return Math.max(quietWindowFloor, 900);
  }

  private estimateStabilizationDelay(
    messages: string[],
    locale: string | null | undefined,
    config: AsyncIntakeRuntimeResource,
  ) {
    const semanticInput = this.buildSemanticInput(messages);
    const normalizedText = this.normalizeText(semanticInput).replace(/\n+/g, ' ');
    const lexicon = this.resolveLexicon(config, locale);
    const rules = config.stabilization;

    if (!normalizedText) {
      return rules.defaultDelayMs;
    }

    if (this.looksLikeFragmentaryContinuation(normalizedText, lexicon)) {
      return rules.fragmentContinuationDelayMs;
    }

    if (
      COMPLETED_SENTENCE_REGEX.test(normalizedText) &&
      normalizedText.length >= rules.longCompletedLengthThreshold
    ) {
      return rules.longCompletedDelayMs;
    }

    if (this.hasTrailingThought(normalizedText, lexicon)) {
      return rules.trailingThoughtDelayMs;
    }

    if (normalizedText.length <= rules.shortMessageLengthThreshold) {
      return rules.shortMessageDelayMs;
    }

    if (
      !COMPLETED_SENTENCE_REGEX.test(normalizedText) &&
      normalizedText.length <= rules.mediumMessageLengthThreshold
    ) {
      return rules.mediumIncompleteDelayMs;
    }

    return rules.defaultDelayMs;
  }

  private looksLikeFragmentaryContinuation(
    normalizedText: string,
    lexicon: AsyncIntakeLexicon,
  ) {
    if (!normalizedText || QUESTION_REGEX.test(normalizedText)) {
      return false;
    }

    const leadingRegex = this.buildLeadingTokenRegex(lexicon.leadingTokens);

    if (leadingRegex?.test(normalizedText)) {
      return true;
    }

    const slotRegex = this.buildSlotRegex(lexicon.slotPatterns);
    return slotRegex?.test(normalizedText) ?? false;
  }

  private hasTrailingThought(normalizedText: string, lexicon: AsyncIntakeLexicon) {
    const trailingRegex = this.buildTrailingTokenRegex(lexicon.trailingTokens);

    if (trailingRegex?.test(normalizedText)) {
      return true;
    }

    return /[:,-]\s*$/u.test(normalizedText);
  }

  private buildLeadingTokenRegex(tokens: string[]) {
    if (tokens.length === 0) {
      return null;
    }

    return new RegExp(
      `^(?:${tokens.map((token) => escapeRegex(token)).join('|')})\\b`,
      'iu',
    );
  }

  private buildTrailingTokenRegex(tokens: string[]) {
    if (tokens.length === 0) {
      return null;
    }

    return new RegExp(
      `\\b(?:${tokens.map((token) => escapeRegex(token)).join('|')})\\s*$`,
      'iu',
    );
  }

  private buildSlotRegex(patterns: string[]) {
    if (patterns.length === 0) {
      return null;
    }

    return new RegExp(`^(?:${patterns.join('|')})$`, 'iu');
  }

  private resolveLexicon(
    config: AsyncIntakeRuntimeResource,
    locale: string | null | undefined,
  ): AsyncIntakeLexicon {
    const normalizedLocale = this.normalizeLocale(locale);
    const defaultLexicon = config.lexicons.default ?? {
      leadingTokens: [],
      trailingTokens: [],
      slotPatterns: [],
    };
    const localeLexicon =
      (normalizedLocale
        ? config.lexicons[normalizedLocale] ??
          config.lexicons[normalizedLocale.split('-')[0]]
        : null) ?? null;

    return {
      leadingTokens: dedupe([
        ...defaultLexicon.leadingTokens,
        ...(localeLexicon?.leadingTokens ?? []),
      ]),
      trailingTokens: dedupe([
        ...defaultLexicon.trailingTokens,
        ...(localeLexicon?.trailingTokens ?? []),
      ]),
      slotPatterns: dedupe([
        ...defaultLexicon.slotPatterns,
        ...(localeLexicon?.slotPatterns ?? []),
      ]),
    };
  }

  private normalizeLocale(locale: string | null | undefined) {
    const normalized = locale?.trim().toLowerCase() ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeText(value: string) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private async getConfig() {
    return (
      (await this.criticalConfigService.getAsyncIntakeConfig()) ??
      buildDefaultAsyncIntakeRuntimeResource()
    );
  }
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
