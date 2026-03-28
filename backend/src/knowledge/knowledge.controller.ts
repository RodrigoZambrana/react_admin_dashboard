import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import { KnowledgeService } from './knowledge.service'
import { ListKnowledgeDocumentsDto } from './dto/list-knowledge-documents.dto'
import { ListKnowledgeCandidatesDto } from './dto/list-knowledge-candidates.dto'
import { CreateCuratedKnowledgeDto } from './dto/create-curated-knowledge.dto'
import { CreateKnowledgeCandidateDto } from './dto/create-knowledge-candidate.dto'
import { ReviewKnowledgeCandidateDto } from './dto/review-knowledge-candidate.dto'
import { RetrieveKnowledgeDto } from './dto/retrieve-knowledge.dto'
import { IndexKnowledgeDocumentsDto } from './dto/index-knowledge-documents.dto'
import { ListKnowledgeRawEventsDto } from './dto/list-knowledge-raw-events.dto'
import { ListKnowledgeIngestionRunsDto } from './dto/list-knowledge-ingestion-runs.dto'
import { IngestConversationKnowledgeDto } from './dto/ingest-conversation-knowledge.dto'
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto'
import { CreateKnowledgeUrlDto } from './dto/create-knowledge-url.dto'
import { ListKnowledgeFeedbackDto } from './dto/list-knowledge-feedback.dto'
import { GetLatestKnowledgeSnapshotDto } from './dto/get-latest-knowledge-snapshot.dto'
import { GetKnowledgeSnapshotDiffDto } from './dto/get-knowledge-snapshot-diff.dto'
import { ListKnowledgeConversationBundlesDto } from './dto/list-knowledge-conversation-bundles.dto'
import { ListKnowledgeNegativeExamplesDto } from './dto/list-knowledge-negative-examples.dto'
import { ReviewKnowledgeConversationBundleDto } from './dto/review-knowledge-conversation-bundle.dto'
import { ReviewKnowledgeNegativeExampleDto } from './dto/review-knowledge-negative-example.dto'
import { RefreshKnowledgeUrlDocumentsDto } from './dto/refresh-knowledge-url-documents.dto'
import { GetKnowledgeQuoteProfilesAdminDto } from './dto/get-knowledge-quote-profiles-admin.dto'
import { UpsertKnowledgeQuoteProfilesDto } from './dto/upsert-knowledge-quote-profiles.dto'

@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('overview')
  getOverview(@Query('tenantKey') tenantKey?: string) {
    return this.knowledge.getOverview(tenantKey)
  }

  @Get('snapshots/latest')
  getLatestSnapshot(@Query() query: GetLatestKnowledgeSnapshotDto) {
    return this.knowledge.getLatestSnapshot(query)
  }

  @Get('snapshots/:id')
  getSnapshot(@Param('id') id: string) {
    return this.knowledge.getSnapshot(id)
  }

  @Get('snapshots/:id/plain-text')
  getSnapshotPlainText(@Param('id') id: string) {
    return this.knowledge.getSnapshotPlainText(id)
  }

  @Get('snapshots/:id/diff')
  getSnapshotDiff(
    @Param('id') id: string,
    @Query() query: GetKnowledgeSnapshotDiffDto,
  ) {
    return this.knowledge.getSnapshotDiff(id, query.compareToId)
  }

  @Get('documents')
  listDocuments(@Query() query: ListKnowledgeDocumentsDto) {
    return this.knowledge.listDocuments(query)
  }

  @Get('documents/:id')
  getDocument(@Param('id') id: string) {
    return this.knowledge.getDocument(id)
  }

  @Patch('documents/:id')
  updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.updateDocument(id, dto, Number(req.user?.sub))
  }

  @Post('documents/upload')
  async uploadDocument(
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    const parsed = await parseSingleFileMultipart(req)
    if (!parsed.file) {
      throw new BadRequestException('knowledge.fileRequired')
    }

    return this.knowledge.uploadSourceDocument(
      {
        tenantKey: parsed.fields.tenantKey || undefined,
        scope:
          parsed.fields.scope === 'customer_public'
            ? 'customer_public'
            : 'admin_internal',
        title: parsed.fields.title || undefined,
        summary: parsed.fields.summary || undefined,
        tags: parsed.fields.tags
          ? parsed.fields.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : undefined,
        replaceDocumentId: parsed.fields.replaceDocumentId || undefined,
      },
      parsed.file,
      Number(req.user?.sub),
    )
  }

  @Delete('documents/:id')
  deleteDocument(@Param('id') id: string) {
    return this.knowledge.deleteDocument(id)
  }

  @Post('documents/url')
  createUrlDocument(
    @Body() dto: CreateKnowledgeUrlDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.createUrlDocument(dto, Number(req.user?.sub))
  }

  @Post('documents/refresh-due')
  refreshDueUrlDocuments(
    @Body() dto: RefreshKnowledgeUrlDocumentsDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.refreshDueUrlDocuments(dto, Number(req.user?.sub))
  }

  @Post('documents/:id/refresh')
  refreshUrlDocument(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.refreshUrlDocument(id, Number(req.user?.sub))
  }

  @Get('documents/:id/file')
  async downloadDocumentSource(
    @Param('id') id: string,
    @Res() res: FastifyReply,
  ) {
    const file = await this.knowledge.getDocumentSourceFile(id)
    res.header('content-type', file.mimeType)
    res.header(
      'content-disposition',
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    )
    return res.send(file.buffer)
  }

  @Get('quote-profiles/manage')
  getQuoteProfilesManage(@Query() query: GetKnowledgeQuoteProfilesAdminDto) {
    return this.knowledge.getManagedQuoteProfiles(query)
  }

  @Put('quote-profiles/manage')
  upsertQuoteProfilesManage(
    @Body() dto: UpsertKnowledgeQuoteProfilesDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.upsertManagedQuoteProfiles(dto, Number(req.user?.sub))
  }

  @Post('quote-profiles/manage/sync')
  syncQuoteProfilesManage(
    @Body() dto: GetKnowledgeQuoteProfilesAdminDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.syncManagedQuoteProfiles(dto, Number(req.user?.sub))
  }

  @Get('search')
  retrieve(@Query() query: RetrieveKnowledgeDto) {
    return this.knowledge.retrieve(query)
  }

  @Get('candidates')
  listCandidates(@Query() query: ListKnowledgeCandidatesDto) {
    return this.knowledge.listCandidates(query)
  }

  @Get('candidates/:id')
  getCandidate(@Param('id') id: string) {
    return this.knowledge.getCandidate(id)
  }

  @Get('raw-events')
  listRawEvents(@Query() query: ListKnowledgeRawEventsDto) {
    return this.knowledge.listRawEvents(query)
  }

  @Get('raw-events/:id')
  getRawEvent(@Param('id') id: string) {
    return this.knowledge.getRawEvent(id)
  }

  @Get('ingestion-runs')
  listIngestionRuns(@Query() query: ListKnowledgeIngestionRunsDto) {
    return this.knowledge.listIngestionRuns(query)
  }

  @Get('feedback')
  listFeedback(@Query() query: ListKnowledgeFeedbackDto) {
    return this.knowledge.listFeedback(query)
  }

  @Get('conversation-bundles')
  listConversationBundles(@Query() query: ListKnowledgeConversationBundlesDto) {
    return this.knowledge.listConversationBundles(query)
  }

  @Get('conversation-bundles/:id')
  getConversationBundle(@Param('id') id: string) {
    return this.knowledge.getConversationBundle(id)
  }

  @Post('conversation-bundles/:id/review')
  reviewConversationBundle(
    @Param('id') id: string,
    @Body() dto: ReviewKnowledgeConversationBundleDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.reviewConversationBundle(id, dto, Number(req.user?.sub))
  }

  @Get('negative-examples')
  listNegativeExamples(@Query() query: ListKnowledgeNegativeExamplesDto) {
    return this.knowledge.listNegativeExamples(query)
  }

  @Get('negative-examples/:id')
  getNegativeExample(@Param('id') id: string) {
    return this.knowledge.getNegativeExample(id)
  }

  @Post('negative-examples/:id/review')
  reviewNegativeExample(
    @Param('id') id: string,
    @Body() dto: ReviewKnowledgeNegativeExampleDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.reviewNegativeExample(id, dto, Number(req.user?.sub))
  }

  @Post('curated')
  createCurated(
    @Body() dto: CreateCuratedKnowledgeDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.createCuratedDocument(dto, Number(req.user?.sub))
  }

  @Post('ingest/docs')
  ingestDocs(
    @Body('tenantKey') tenantKey: string | undefined,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.ingestTrustedDocs(Number(req.user?.sub), tenantKey)
  }

  @Post('ingest/datasets')
  ingestDatasets(
    @Body('tenantKey') tenantKey: string | undefined,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.ingestDatasets(Number(req.user?.sub), tenantKey)
  }

  @Post('ingest/conversations')
  ingestConversations(
    @Body() dto: IngestConversationKnowledgeDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.ingestConversationMessages(dto, Number(req.user?.sub))
  }

  @Post('index')
  indexDocuments(
    @Body() dto: IndexKnowledgeDocumentsDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.indexDocuments(dto, Number(req.user?.sub))
  }

  @Post('candidates/from-conversation')
  createCandidate(
    @Body() dto: CreateKnowledgeCandidateDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.createCandidateFromConversation(dto, Number(req.user?.sub))
  }

  @Post('candidates/:id/review')
  reviewCandidate(
    @Param('id') id: string,
    @Body() dto: ReviewKnowledgeCandidateDto,
    @Req() req: FastifyRequest & { user: { sub: string } },
  ) {
    return this.knowledge.reviewCandidate(id, dto, Number(req.user?.sub))
  }
}
