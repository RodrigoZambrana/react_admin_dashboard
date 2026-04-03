import { Module } from '@nestjs/common';

import { DateParser } from './date.parser';
import { DimensionParser } from './dimension.parser';
import { MeasurementParser } from './measurement.parser';
import { ParsingService } from './parsing.service';

@Module({
  providers: [ParsingService, DateParser, MeasurementParser, DimensionParser],
  exports: [ParsingService],
})
export class ParsingModule {}
