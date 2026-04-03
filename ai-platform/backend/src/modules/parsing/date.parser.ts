import { Injectable } from '@nestjs/common';
import * as chrono from 'chrono-node';

import { TemporalExpressionService } from '../temporal/temporal-expression.service';

export type NormalizedDate = {
  source: string;
  iso: string;
  precision: 'date' | 'datetime';
};

@Injectable()
export class DateParser {
  constructor(
    private readonly temporalExpressionService: TemporalExpressionService,
  ) {}

  parseCandidates(
    text: string,
    candidates: string[],
    referenceDate = new Date(),
    locale?: string | null,
  ): NormalizedDate[] {
    const inputs = this.collectSafeDateInputs(text, candidates, locale);
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

  private collectSafeDateInputs(
    text: string,
    candidates: string[],
    locale?: string | null,
  ) {
    const extracted = new Set<string>();

    for (const candidate of candidates) {
      for (const expression of this.temporalExpressionService.extractExpressions(
        candidate,
        locale,
      )) {
        extracted.add(expression);
      }
    }

    for (const expression of this.temporalExpressionService.extractExpressions(
      text,
      locale,
    )) {
      extracted.add(expression);
    }

    return extracted;
  }
}
