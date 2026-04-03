import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { CanonicalInterpretation } from '../interpretation/interpretation.schemas';
import { DateParser, NormalizedDate } from './date.parser';
import { DimensionParser, NormalizedDimension } from './dimension.parser';
import { MeasurementParser, NormalizedMeasurement } from './measurement.parser';

export type ParsedInterpretation = CanonicalInterpretation & {
  normalizedEntities: {
    dates: NormalizedDate[];
    measurements: NormalizedMeasurement[];
    dimensions: NormalizedDimension[];
  };
};

@Injectable()
export class ParsingService {
  constructor(
    private readonly dateParser: DateParser,
    private readonly measurementParser: MeasurementParser,
    private readonly dimensionParser: DimensionParser,
    private readonly logger: PipelineLoggerService,
  ) {}

  async normalize(
    interpretation: CanonicalInterpretation,
    referenceDate = new Date(),
  ): Promise<ParsedInterpretation> {
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
    const dimensionCandidates = Array.isArray(
      interpretation.entities.dimensionCandidates,
    )
      ? interpretation.entities.dimensionCandidates.filter(
          (candidate): candidate is string => typeof candidate === 'string',
        )
      : [];

    const normalized: ParsedInterpretation = {
      ...interpretation,
      normalizedEntities: {
        dates: await this.dateParser.parseCandidates(
          message,
          dateCandidates,
          referenceDate,
          interpretation.language,
        ),
        measurements: this.measurementParser.parseCandidates(
          message,
          measurementCandidates,
        ),
        dimensions: this.dimensionParser.parseCandidates(
          message,
          dimensionCandidates,
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
