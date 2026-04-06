import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { AdminTestCenterService } from './admin-test-center.service';
import { AdminTestCenterEvaluateDto } from './dto/admin-test-center-evaluate.dto';
import { AdminTestCenterReplayDto } from './dto/admin-test-center-replay.dto';
import { CompareTracesDto } from './dto/compare-traces.dto';

@Controller('admin/test-center')
export class AdminTestCenterController {
  constructor(private readonly adminTestCenterService: AdminTestCenterService) {}

  @Get('conversations')
  listTestRuns(@Query('limit') limit?: string) {
    return this.adminTestCenterService.listTestRuns(Number(limit ?? 20));
  }

  @Get('scenarios')
  listScenarios(@Query('locale') locale?: string) {
    return this.adminTestCenterService.listScenarios(locale);
  }

  @Get('conversations/:conversationId')
  getTestRun(@Param('conversationId') conversationId: string) {
    return this.adminTestCenterService.getTestRun(conversationId);
  }

  @Post('conversations/:conversationId/evaluate')
  evaluateConversation(
    @Param('conversationId') conversationId: string,
    @Body() body: AdminTestCenterEvaluateDto,
  ) {
    return this.adminTestCenterService.evaluateConversation({
      conversationId,
      scenarioId: body.scenarioId,
      locale: body.locale,
    });
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
