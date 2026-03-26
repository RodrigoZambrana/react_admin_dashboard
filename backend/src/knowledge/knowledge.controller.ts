import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
