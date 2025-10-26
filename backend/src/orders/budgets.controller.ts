import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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

@UseGuards(JwtAuthGuard, BudgetsFeatureGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly documents: SalesDocumentsService) {}

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
  getBudgetDetails(@Param('id', ParseIntPipe) id: number) {
    return this.documents.getDocumentDetails(DocumentType.BUDGET, id)
  }

  @Get(':id/pdf')
  getBudgetPdf(@Param('id', ParseIntPipe) id: number) {
    return this.documents.getDocumentPdf(DocumentType.BUDGET, id)
  }

  @Post()
  createBudget(@Body() dto: CreateOrderDto) {
    return this.documents.createDocument(DocumentType.BUDGET, dto)
  }

  @Put(':id')
  replaceBudget(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateOrderDto) {
    return this.documents.replaceDocument(DocumentType.BUDGET, id, dto)
  }

  @Patch(':id/comment')
  updateBudgetComment(@Param('id', ParseIntPipe) id: number, @Body() body: { comment?: string }) {
    return this.documents.updateDocumentComment(DocumentType.BUDGET, id, body)
  }

  @Put(':id/status')
  updateBudgetStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: number; force?: boolean },
  ) {
    return this.documents.updateDocumentStatus(DocumentType.BUDGET, id, body)
  }

  @Put(':id/payment-method')
  updateBudgetPaymentMethod(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentMehod?: string | number | null },
  ) {
    return this.documents.updateDocumentPaymentMethod(DocumentType.BUDGET, id, body)
  }

  @Post(':id/document')
  async uploadBudgetDocument(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const { file } = await parseSingleFileMultipart(req)
    return this.documents.persistDocumentFile(DocumentType.BUDGET, id, file)
  }

  @Post(':id/send')
  sendBudget(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const userId = (req as FastifyRequest & { user?: { id?: number } }).user?.id ?? null
    return this.documents.sendBudget(id, userId)
  }

  @Post(':id/confirm')
  confirmBudget(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const userId = (req as FastifyRequest & { user?: { id?: number } }).user?.id ?? null
    return this.documents.confirmBudget(id, userId)
  }
}
