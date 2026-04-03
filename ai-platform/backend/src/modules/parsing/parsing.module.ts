import { Module } from '@nestjs/common';

import { TemporalModule } from '../temporal/temporal.module';
import { DateParser } from './date.parser';
import { DimensionParser } from './dimension.parser';
import { MeasurementParser } from './measurement.parser';
import { ParsingService } from './parsing.service';

@Module({
  imports: [TemporalModule],
  providers: [ParsingService, DateParser, MeasurementParser, DimensionParser],
  exports: [ParsingService],
})
export class ParsingModule {}
