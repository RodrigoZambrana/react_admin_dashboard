import { Inject, Injectable } from '@nestjs/common';

import { TemporalLocaleResource } from './temporal-locale.types';
import { TemporalLocaleProvider } from './temporal-locale.provider';

const structuralDatePatterns = [
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi,
  /\b\d{4}-\d{2}-\d{2}\b/g,
];
const timeValuePattern = '\\d{1,2}(?::\\d{2})?';

@Injectable()
export class TemporalExpressionService {
  constructor(
    @Inject(TemporalLocaleProvider)
    private readonly temporalLocaleProvider: TemporalLocaleProvider,
  ) {}

  extractExpressions(input: string, locale?: string | null): string[] {
    if (!input.trim()) {
      return [];
    }

    const expressions = new Set<string>();

    for (const resource of this.temporalLocaleProvider.resolveResources(locale)) {
      const lexicalPattern = this.buildLexicalPattern(resource);

      for (const match of input.matchAll(lexicalPattern)) {
        expressions.add(match[0].trim());
      }
    }

    for (const pattern of structuralDatePatterns) {
      for (const match of input.matchAll(pattern)) {
        expressions.add(match[0].trim());
      }
    }

    return Array.from(expressions);
  }

  findMatchingLocales(input: string): string[] {
    if (!input.trim()) {
      return [];
    }

    return this.temporalLocaleProvider
      .listResources()
      .filter((resource) => this.buildLexicalPattern(resource).test(input))
      .map((resource) => resource.locale);
  }

  private buildLexicalPattern(resource: TemporalLocaleResource) {
    const datePhrasePattern = resource.datePhrases
      .map(escapeRegex)
      .sort(byLengthDescending)
      .join('|');
    const timeJoinerPattern = resource.timeJoiners
      .map(escapeRegex)
      .sort(byLengthDescending)
      .join('|');
    const optionalTimePattern = timeJoinerPattern
      ? `(?:\\s+(?:${timeJoinerPattern})\\s+${timeValuePattern})?`
      : '';

    return new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${datePhrasePattern})${optionalTimePattern}(?![\\p{L}\\p{N}])`,
      'giu',
    );
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function byLengthDescending(left: string, right: string) {
  return right.length - left.length;
}
