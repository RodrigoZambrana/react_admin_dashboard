import { Injectable } from '@nestjs/common';

export type NormalizedDimensionUnit = 'mm' | 'cm' | 'm';

export type NormalizedDimensionValue = {
  position: 1 | 2;
  rawValue: number;
  rawUnit: NormalizedDimensionUnit | null;
  normalizedValue: number;
  normalizedUnit: 'mm';
};

export type NormalizedDimension = {
  source: string;
  unitSource: 'explicit' | 'inferred';
  values: [NormalizedDimensionValue, NormalizedDimensionValue];
};

const dimensionPattern =
  /(?<first>\d{1,4}(?:[.,]\d{1,3})?)\s*(?<firstUnit>mm|cm|m)?\s*(?:x|×|por)\s*(?<second>\d{1,4}(?:[.,]\d{1,3})?)\s*(?<secondUnit>mm|cm|m)?\b/gi;

@Injectable()
export class DimensionParser {
  parseCandidates(text: string, candidates: string[]): NormalizedDimension[] {
    const sources = new Set<string>([...candidates, text]);
    const normalized: NormalizedDimension[] = [];

    for (const source of sources) {
      for (const match of source.matchAll(dimensionPattern)) {
        const rawFirst = match.groups?.first ?? '';
        const rawSecond = match.groups?.second ?? '';
        const firstValue = this.parseNumeric(rawFirst);
        const secondValue = this.parseNumeric(rawSecond);

        if (firstValue === null || secondValue === null) {
          continue;
        }

        const resolvedUnits = this.resolveUnits({
          rawFirst,
          rawSecond,
          explicitFirstUnit: this.normalizeUnit(match.groups?.firstUnit),
          explicitSecondUnit: this.normalizeUnit(match.groups?.secondUnit),
          firstValue,
          secondValue,
        });

        const firstDimension = this.toNormalizedDimensionValue(
          1,
          firstValue,
          resolvedUnits.firstUnit,
        );
        const secondDimension = this.toNormalizedDimensionValue(
          2,
          secondValue,
          resolvedUnits.secondUnit,
        );

        if (!firstDimension || !secondDimension) {
          continue;
        }

        normalized.push({
          source: match[0],
          unitSource: resolvedUnits.unitSource,
          values: [firstDimension, secondDimension],
        });
      }
    }

    return normalized.filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.source === item.source &&
            candidate.values[0].normalizedValue === item.values[0].normalizedValue &&
            candidate.values[1].normalizedValue === item.values[1].normalizedValue,
        ) === index,
    );
  }

  private normalizeUnit(value?: string): NormalizedDimensionUnit | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === 'mm' || normalized === 'cm' || normalized === 'm') {
      return normalized;
    }

    return null;
  }

  private parseNumeric(value: string) {
    const normalized = Number(value.replace(',', '.'));
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  }

  private resolveUnits(input: {
    rawFirst: string;
    rawSecond: string;
    explicitFirstUnit: NormalizedDimensionUnit | null;
    explicitSecondUnit: NormalizedDimensionUnit | null;
    firstValue: number;
    secondValue: number;
  }) {
    const sharedExplicitUnit =
      input.explicitFirstUnit ?? input.explicitSecondUnit ?? null;

    if (sharedExplicitUnit) {
      return {
        firstUnit: sharedExplicitUnit,
        secondUnit: sharedExplicitUnit,
        unitSource: 'explicit' as const,
      };
    }

    return {
      firstUnit: this.inferImplicitUnit(
        input.rawFirst,
        input.firstValue,
        input.firstValue,
        input.secondValue,
      ),
      secondUnit: this.inferImplicitUnit(
        input.rawSecond,
        input.secondValue,
        input.firstValue,
        input.secondValue,
      ),
      unitSource: 'inferred' as const,
    };
  }

  private inferImplicitUnit(
    rawValue: string,
    numericValue: number,
    firstPairValue: number,
    secondPairValue: number,
  ): NormalizedDimensionUnit {
    const hasDecimals = /[.,]/.test(rawValue);
    const minPairValue = Math.min(firstPairValue, secondPairValue);

    if (hasDecimals) {
      if (numericValue <= 10) {
        return 'm';
      }

      if (numericValue <= 500) {
        return 'cm';
      }

      return 'mm';
    }

    if (numericValue >= 1000) {
      return 'mm';
    }

    if (minPairValue <= 10) {
      return 'm';
    }

    if (numericValue >= 30 && numericValue <= 500) {
      return 'cm';
    }

    return 'm';
  }

  private toNormalizedDimensionValue(
    position: 1 | 2,
    rawValue: number,
    rawUnit: NormalizedDimensionUnit,
  ): NormalizedDimensionValue | null {
    const normalizedValue =
      rawUnit === 'm'
        ? Math.round(rawValue * 1000)
        : rawUnit === 'cm'
          ? Math.round(rawValue * 10)
          : Math.round(rawValue);

    if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
      return null;
    }

    return {
      position,
      rawValue,
      rawUnit,
      normalizedValue,
      normalizedUnit: 'mm',
    };
  }
}
