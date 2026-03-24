import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { DocumentType } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { SalesDocumentsService } from './sales-documents.service'
import { CreateOrderDto } from '../sales/dto/order.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { BudgetsFeatureGuard } from './guards/budgets-feature.guard'
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import { PrismaService } from '../prisma/prisma.service'

@UseGuards(JwtAuthGuard, BudgetsFeatureGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(
    private readonly documents: SalesDocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveBudgetIdentifier(identifier: string): Promise<number> {
    const trimmed = identifier.trim()
    if (!trimmed) {
      throw new BadRequestException('sales.budgets.validation.notFound')
    }

    const numericId = Number(trimmed)
    if (Number.isFinite(numericId) && String(numericId) === trimmed) {
      return numericId
    }

    const budget = await this.prisma.order.findFirst({
      where: {
        documentType: DocumentType.BUDGET,
        uuid: trimmed,
      },
      select: { id: true },
    })

    if (!budget) {
      throw new NotFoundException('sales.budgets.validation.notFound')
    }

    return budget.id
  }

  @Get()
  listBudgets(@Query() q: any) {
    return this.documents.listDocuments(DocumentType.BUDGET, q)
  }

  @Get('export')
  exportBudgets(@Query() q: any): Promise<StreamableFile> {
    return this.documents.exportDocuments(DocumentType.BUDGET, q)
  }

  @Post('import')
  importBudgets(@Req() req: FastifyRequest) {
    return this.documents.importDocuments(DocumentType.BUDGET, req)
  }

  @Delete()
  deleteBudgets(@Body() body: { id: string | string[] }) {
    return this.documents.deleteDocuments(DocumentType.BUDGET, body)
  }

  @Get(':id/details')
  async getBudgetDetails(@Param('id') identifier: string) {
    const id = await this.resolveBudgetIdentifier(identifier)
    return this.documents.getDocumentDetails(DocumentType.BUDGET, id)
  }

  @Get(':id/pdf')
  async getBudgetPdf(@Param('id') identifier: string) {
    const id = await this.resolveBudgetIdentifier(identifier)
    return this.documents.getDocumentPdf(DocumentType.BUDGET, id)
  }

  @Post()
  createBudget(@Body() dto: CreateOrderDto) {
    return this.documents.createDocument(DocumentType.BUDGET, dto)
  }

  @Put(':id')
  async replaceBudget(@Param('id') identifier: string, @Body() dto: CreateOrderDto) {
    const id = await this.resolveBudgetIdentifier(identifier)
    return this.documents.replaceDocument(DocumentType.BUDGET, id, dto)
  }

  @Patch(':id/comment')
  async updateBudgetComment(@Param('id') identifier: string, @Body() body: { comment?: string }) {
    const id = await this.resolveBudgetIdentifier(identifier)
    return this.documents.updateDocumentComment(DocumentType.BUDGET, id, body)
  }

  @Put(':id/status')
  async updateBudgetStatus(
    @Param('id') identifier: string,
    @Body() body: { status: number; force?: boolean },
  ) {
    const id = await this.resolveBudgetIdentifier(identifier)
    return this.documents.updateDocumentStatus(DocumentType.BUDGET, id, body)
  }

  @Put(':id/payment-method')
  async updateBudgetPaymentMethod(
    @Param('id') identifier: string,
    @Body() body: { paymentMehod?: string | number | null },
  ) {
    const id = await this.resolveBudgetIdentifier(identifier)
    return this.documents.updateDocumentPaymentMethod(DocumentType.BUDGET, id, body)
  }

  @Post(':id/document')
  async uploadBudgetDocument(@Param('id') identifier: string, @Req() req: FastifyRequest) {
    const id = await this.resolveBudgetIdentifier(identifier)
    const { file } = await parseSingleFileMultipart(req)
    return this.documents.persistDocumentFile(DocumentType.BUDGET, id, file)
  }

  @Post(':id/send')
  async sendBudget(@Param('id') identifier: string, @Req() req: FastifyRequest) {
    const id = await this.resolveBudgetIdentifier(identifier)
    const userId = (req as FastifyRequest & { user?: { id?: number } }).user?.id ?? null
    return this.documents.sendBudget(id, userId)
  }

  @Post(':id/confirm')
  async confirmBudget(@Param('id') identifier: string, @Req() req: FastifyRequest) {
    const id = await this.resolveBudgetIdentifier(identifier)
    const userId = (req as FastifyRequest & { user?: { id?: number } }).user?.id ?? null
    return this.documents.confirmBudget(id, userId)
  }
}
