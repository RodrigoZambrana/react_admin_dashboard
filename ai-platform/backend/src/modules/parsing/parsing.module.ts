import { Module } from '@nestjs/common';

import { DateParser } from './date.parser';
import { MeasurementParser } from './measurement.parser';
import { ParsingService } from './parsing.service';

@Module({
  providers: [ParsingService, DateParser, MeasurementParser],
  exports: [ParsingService],
})
export class ParsingModule {}
