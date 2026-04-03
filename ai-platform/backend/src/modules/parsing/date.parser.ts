import { Injectable } from '@nestjs/common';
import * as chrono from 'chrono-node';

export type NormalizedDate = {
  source: string;
  iso: string;
  precision: 'date' | 'datetime';
};

@Injectable()
export class DateParser {
  parseCandidates(
    text: string,
    candidates: string[],
    referenceDate = new Date(),
  ): NormalizedDate[] {
    const inputs = new Set<string>([...candidates, text]);
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
}
