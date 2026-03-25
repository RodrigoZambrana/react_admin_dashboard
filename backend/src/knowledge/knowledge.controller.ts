import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { KnowledgeService } from './knowledge.service'
import { ListKnowledgeDocumentsDto } from './dto/list-knowledge-documents.dto'
import { ListKnowledgeCandidatesDto } from './dto/list-knowledge-candidates.dto'
import { CreateCuratedKnowledgeDto } from './dto/create-curated-knowledge.dto'
import { CreateKnowledgeCandidateDto } from './dto/create-knowledge-candidate.dto'
import { ReviewKnowledgeCandidateDto } from './dto/review-knowledge-candidate.dto'
import { RetrieveKnowledgeDto } from './dto/retrieve-knowledge.dto'
import { IndexKnowledgeDocumentsDto } from './dto/index-knowledge-documents.dto'

@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('overview')
  getOverview(@Query('tenantKey') tenantKey?: string) {
    return this.knowledge.getOverview(tenantKey)
  }

  @Get('documents')
  listDocuments(@Query() query: ListKnowledgeDocumentsDto) {
    return this.knowledge.listDocuments(query)
  }

  @Get('search')
  retrieve(@Query() query: RetrieveKnowledgeDto) {
    return this.knowledge.retrieve(query)
  }

  @Get('candidates')
  listCandidates(@Query() query: ListKnowledgeCandidatesDto) {
    return this.knowledge.listCandidates(query)
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
