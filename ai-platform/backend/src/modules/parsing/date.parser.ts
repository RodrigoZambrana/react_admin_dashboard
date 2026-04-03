import { Injectable } from '@nestjs/common';
import * as chrono from 'chrono-node';

export type NormalizedDate = {
  source: string;
  iso: string;
  precision: 'date' | 'datetime';
};

const boundedDateExpressionPattern =
  /\b(?:today|tomorrow|tonight|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|hoy|mañana|pasado mañana|la próxima semana|la proxima semana|el lunes|el martes|el miércoles|el miercoles|el jueves|el viernes|el sábado|el sabado|el domingo|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})(?:\s+(?:at\s+\d{1,2}(?::\d{2})?|a\s+las\s+\d{1,2}(?::\d{2})?))?\b/gi;

@Injectable()
export class DateParser {
  parseCandidates(
    text: string,
    candidates: string[],
    referenceDate = new Date(),
  ): NormalizedDate[] {
    const inputs = this.collectSafeDateInputs(text, candidates);
    const parsers = [chrono.parse, chrono.es.parse, chrono.en.parse];

    return Array.from(inputs)
      .flatMap((candidate) =>
        parsers.flatMap((parser) =>
          parser(candidate, referenceDate).map((result) => ({
            source: result.text,
            iso: result.start.date().toISOString(),
            precision: result.start.isCertain('hour')
              ? ('datetime' as const)
              : ('date' as const),
          })),
        ),
      )
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) =>
            candidate.source === item.source && candidate.iso === item.iso,
          ) === index,
      );
  }

  private collectSafeDateInputs(text: string, candidates: string[]) {
    const extracted = new Set<string>();

    for (const candidate of candidates) {
      for (const expression of this.extractBoundedExpressions(candidate)) {
        extracted.add(expression);
      }
    }

    for (const expression of this.extractBoundedExpressions(text)) {
      extracted.add(expression);
    }

    return extracted;
  }

  private extractBoundedExpressions(input: string) {
    if (!input.trim()) {
      return [];
    }

    return Array.from(input.matchAll(boundedDateExpressionPattern)).map(
      (match) => match[0].trim(),
    );
  }
}
