import { Injectable } from '@nestjs/common';

const DEFAULT_STABILIZATION_DELAY_MS = 900;
const DEFAULT_MAX_WINDOW_MS = 2600;
const DEFAULT_MIN_REPLY_DELAY_MS = 900;
const DEFAULT_MAX_REPLY_DELAY_MS = 2600;

const FRAGMENTARY_CONTINUATION_REGEX =
  /^(?:de|del|con|sin|para|por|en|y|o|pero|si|sí)\b/iu;
const QUOTE_SLOT_FRAGMENT_REGEX =
  /^(?:\d+(?:[.,]\d+)?\s*(?:x|por)\s*\d+(?:[.,]\d+)?(?:\s*(?:cm|cms|m|mt|mts|mm))?|\d+\s*(?:unidad(?:es)?|unid(?:ades)?|u)\b)/iu;
const TRAILING_THOUGHT_REGEX =
  /(?:\b(de|con|para|porque|por|y|o|que|si|sí|pero)\s*|[:,-]\s*)$/iu;

@Injectable()
export class AsyncTurnTimingPolicyService {
  buildSemanticInput(messages: string[]) {
    return messages
      .map((message) => this.normalizeText(message))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  estimateStabilizationDelay(messages: string[]) {
    const semanticInput = this.buildSemanticInput(messages);
    const normalizedText = this.normalizeText(semanticInput).replace(/\n+/g, ' ');

    if (!normalizedText) {
      return DEFAULT_STABILIZATION_DELAY_MS;
    }

    if (this.looksLikeFragmentaryContinuation(normalizedText)) {
      return Math.max(DEFAULT_STABILIZATION_DELAY_MS + 500, 1700);
    }

    if (/[.!?…]$/.test(normalizedText) && normalizedText.length >= 50) {
      return 350;
    }

    if (TRAILING_THOUGHT_REGEX.test(normalizedText)) {
      return Math.max(DEFAULT_STABILIZATION_DELAY_MS + 300, 1500);
    }

    if (normalizedText.length <= 24) {
      return Math.max(DEFAULT_STABILIZATION_DELAY_MS, 1300);
    }

    if (!/[.!?…]$/.test(normalizedText) && normalizedText.length <= 120) {
      return Math.max(DEFAULT_STABILIZATION_DELAY_MS - 200, 1000);
    }

    return DEFAULT_STABILIZATION_DELAY_MS;
  }

  estimateReplyDelay(response: string) {
    const normalized = this.normalizeText(response);

    if (!normalized) {
      return 0;
    }

    const perChar = Math.min(
      normalized.length * 18,
      DEFAULT_MAX_REPLY_DELAY_MS - DEFAULT_MIN_REPLY_DELAY_MS,
    );

    return Math.min(DEFAULT_MIN_REPLY_DELAY_MS + perChar, DEFAULT_MAX_REPLY_DELAY_MS);
  }

  calculateFlushAt(input: {
    acceptedAt: Date;
    messages: string[];
  }) {
    const stabilizationDelayMs = this.estimateStabilizationDelay(input.messages);
    const maxWindowDeadline = new Date(
      input.acceptedAt.getTime() + DEFAULT_MAX_WINDOW_MS,
    );
    const desiredFlushAt = new Date(
      Date.now() + stabilizationDelayMs,
    );

    return {
      stabilizationDelayMs,
      flushAt:
        desiredFlushAt.getTime() > maxWindowDeadline.getTime()
          ? maxWindowDeadline
          : desiredFlushAt,
    };
  }

  private looksLikeFragmentaryContinuation(normalizedText: string) {
    if (!normalizedText) {
      return false;
    }

    if (/[?¿]$/.test(normalizedText)) {
      return false;
    }

    if (FRAGMENTARY_CONTINUATION_REGEX.test(normalizedText)) {
      return true;
    }

    return QUOTE_SLOT_FRAGMENT_REGEX.test(normalizedText);
  }

  private normalizeText(value: string) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }
}
