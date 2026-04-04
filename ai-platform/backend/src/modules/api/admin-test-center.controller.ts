import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { AdminTestCenterService } from './admin-test-center.service';
import { AdminTestCenterReplayDto } from './dto/admin-test-center-replay.dto';
import { CompareTracesDto } from './dto/compare-traces.dto';

@Controller('admin/test-center')
export class AdminTestCenterController {
  constructor(private readonly adminTestCenterService: AdminTestCenterService) {}

  @Get('conversations')
  listTestRuns(@Query('limit') limit?: string) {
    return this.adminTestCenterService.listTestRuns(Number(limit ?? 20));
  }

  @Get('conversations/:conversationId')
  getTestRun(@Param('conversationId') conversationId: string) {
    return this.adminTestCenterService.getTestRun(conversationId);
  }

  @Get('traces')
  listRecentTraces(@Query('limit') limit?: string) {
    return this.adminTestCenterService.listRecentTraceSummaries(
      Number(limit ?? 20),
    );
  }

  @Get('traces/:traceId')
  getTraceDetail(@Param('traceId') traceId: string) {
    return this.adminTestCenterService.getTraceDetail(traceId);
  }

  @Post('traces/compare')
  compareTraces(@Body() body: CompareTracesDto) {
    return this.adminTestCenterService.compareTraces(
      body.leftTraceId,
      body.rightTraceId,
    );
  }

  @Post('replays')
  replayConversation(@Body() body: AdminTestCenterReplayDto) {
    return this.adminTestCenterService.replayConversation(body);
  }
}
