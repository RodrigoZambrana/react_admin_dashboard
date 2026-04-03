import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { InterpretationResult } from '../interpretation/interpretation.schemas';
import { DateParser, NormalizedDate } from './date.parser';
import { MeasurementParser, NormalizedMeasurement } from './measurement.parser';

export type NormalizedInterpretation = InterpretationResult & {
  normalizedEntities: {
    dates: NormalizedDate[];
    measurements: NormalizedMeasurement[];
  };
};

@Injectable()
export class ParsingService {
  constructor(
    private readonly dateParser: DateParser,
    private readonly measurementParser: MeasurementParser,
    private readonly logger: PipelineLoggerService,
  ) {}

  normalize(
    interpretation: InterpretationResult,
    referenceDate = new Date(),
  ): NormalizedInterpretation {
    const message =
      typeof interpretation.entities.rawMessage === 'string'
        ? interpretation.entities.rawMessage
        : '';
    const dateCandidates = Array.isArray(interpretation.entities.dateCandidates)
      ? interpretation.entities.dateCandidates.filter(
          (candidate): candidate is string => typeof candidate === 'string',
        )
      : [];
    const measurementCandidates = Array.isArray(
      interpretation.entities.measurementCandidates,
    )
      ? interpretation.entities.measurementCandidates.filter(
          (candidate): candidate is string => typeof candidate === 'string',
        )
      : [];

    const normalized: NormalizedInterpretation = {
      ...interpretation,
      normalizedEntities: {
        dates: this.dateParser.parseCandidates(
          message,
          dateCandidates,
          referenceDate,
        ),
        measurements: this.measurementParser.parseCandidates(
          message,
          measurementCandidates,
        ),
      },
    };

    this.logger.log(
      JSON.stringify({
        stage: 'parsing',
        output: normalized.normalizedEntities,
      }),
    );

    return normalized;
  }
}
