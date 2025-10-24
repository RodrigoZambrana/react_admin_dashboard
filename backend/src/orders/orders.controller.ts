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
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { SalesDocumentsService } from './sales-documents.service'
import { CreateOrderDto } from '../sales/dto/order.dto'

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly documents: SalesDocumentsService) {}

  @Get()
  listOrders(@Query() q: any) {
    return this.documents.listDocuments(DocumentType.ORDER, q)
  }

  @Get('export')
  exportOrders(@Query() q: any): Promise<StreamableFile> {
    return this.documents.exportDocuments(DocumentType.ORDER, q)
  }

  @Post('import')
  importOrders(@Req() req: FastifyRequest) {
    return this.documents.importDocuments(DocumentType.ORDER, req)
  }

  @Delete()
  deleteOrders(@Body() body: { id: string | string[] }) {
    return this.documents.deleteDocuments(DocumentType.ORDER, body)
  }

  @Get(':id/details')
  getOrderDetails(@Param('id', ParseIntPipe) id: number) {
    return this.documents.getDocumentDetails(DocumentType.ORDER, id)
  }

  @Get(':id/pdf')
  getOrderPdf(@Param('id', ParseIntPipe) id: number) {
    return this.documents.getDocumentPdf(DocumentType.ORDER, id)
  }

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return this.documents.createDocument(DocumentType.ORDER, dto)
  }

  @Put(':id')
  replaceOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateOrderDto) {
    return this.documents.replaceDocument(DocumentType.ORDER, id, dto)
  }

  @Patch(':id/comment')
  updateOrderComment(@Param('id', ParseIntPipe) id: number, @Body() body: { comment?: string }) {
    return this.documents.updateDocumentComment(DocumentType.ORDER, id, body)
  }

  @Put(':id/status')
  updateOrderStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: number }) {
    return this.documents.updateDocumentStatus(DocumentType.ORDER, id, body)
  }

  @Put(':id/payment-method')
  updateOrderPaymentMethod(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentMehod?: string | number | null },
  ) {
    return this.documents.updateDocumentPaymentMethod(DocumentType.ORDER, id, body)
  }
}
