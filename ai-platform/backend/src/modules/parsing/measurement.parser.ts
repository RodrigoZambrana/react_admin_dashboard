import { Injectable } from '@nestjs/common';

export type NormalizedMeasurement = {
  source: string;
  value: number;
  unit: string;
  normalizedValue: number;
  normalizedUnit: string;
  kind: 'length' | 'mass' | 'volume';
};

const measurementPattern =
  /(?<value>\d+(?:[.,]\d+)?)\s?(?<unit>mm|cm|m|km|g|kg|lb|lbs|ml|l)\b/gi;

const units: Record<
  string,
  {
    normalizedUnit: string;
    factor: number;
    kind: NormalizedMeasurement['kind'];
  }
> = {
  mm: { normalizedUnit: 'cm', factor: 0.1, kind: 'length' },
  cm: { normalizedUnit: 'cm', factor: 1, kind: 'length' },
  m: { normalizedUnit: 'cm', factor: 100, kind: 'length' },
  km: { normalizedUnit: 'cm', factor: 100000, kind: 'length' },
  g: { normalizedUnit: 'kg', factor: 0.001, kind: 'mass' },
  kg: { normalizedUnit: 'kg', factor: 1, kind: 'mass' },
  lb: { normalizedUnit: 'kg', factor: 0.453592, kind: 'mass' },
  lbs: { normalizedUnit: 'kg', factor: 0.453592, kind: 'mass' },
  ml: { normalizedUnit: 'l', factor: 0.001, kind: 'volume' },
  l: { normalizedUnit: 'l', factor: 1, kind: 'volume' },
};

@Injectable()
export class MeasurementParser {
  parseCandidates(text: string, candidates: string[]): NormalizedMeasurement[] {
    const sources = new Set<string>([...candidates, text]);
    const normalized: NormalizedMeasurement[] = [];

    for (const source of sources) {
      for (const match of source.matchAll(measurementPattern)) {
        const unit = match.groups?.unit?.toLowerCase();
        const value = Number((match.groups?.value ?? '0').replace(',', '.'));

        if (!unit || !units[unit]) {
          continue;
        }

        const unitConfig = units[unit];
        normalized.push({
          source: match[0],
          value,
          unit,
          normalizedValue: Number((value * unitConfig.factor).toFixed(3)),
          normalizedUnit: unitConfig.normalizedUnit,
          kind: unitConfig.kind,
        });
      }
    }

    return normalized.filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.source === item.source &&
            candidate.normalizedValue === item.normalizedValue &&
            candidate.normalizedUnit === item.normalizedUnit,
        ) === index,
    );
  }
}
