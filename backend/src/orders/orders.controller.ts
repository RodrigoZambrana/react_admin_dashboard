import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import { OrderTimelineService } from './order-timeline.service'
import { UpdateOrderDeliveryDto } from './dto/update-delivery.dto'

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly documents: SalesDocumentsService,
    private readonly timeline: OrderTimelineService,
  ) {}

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

  @Get(':id/timeline')
  async getOrderTimeline(@Param('id', ParseIntPipe) id: number) {
    const timeline = await this.timeline.getOrderTimeline(id)
    if (!timeline || timeline.order.documentType !== DocumentType.ORDER) {
      throw new NotFoundException('sales.orders.validation.notFound')
    }
    const { order, events } = timeline
    return {
      order: {
        id: order.id,
        customerId: order.customerId,
        statusId: order.statusId,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        date: order.date.toISOString(),
        grandTotal: Number(order.grandTotal?.toString?.() ?? order.grandTotal ?? 0),
        orderCurrency: order.orderCurrency,
        estimatedMin: order.estimatedMin,
        estimatedMax: order.estimatedMax,
      },
      events,
    }
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

  @Patch(':id/delivery')
  updateOrderDelivery(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDeliveryDto,
  ) {
    return this.documents.updateOrderDeliveryDetails(id, dto)
  }

  @Put(':id/status')
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: number; force?: boolean },
  ) {
    return this.documents.updateDocumentStatus(DocumentType.ORDER, id, body)
  }

  @Put(':id/payment-method')
  updateOrderPaymentMethod(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentMehod?: string | number | null },
  ) {
    return this.documents.updateDocumentPaymentMethod(DocumentType.ORDER, id, body)
  }

  @Post(':id/document')
  async uploadOrderDocument(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const { file } = await parseSingleFileMultipart(req)
    return this.documents.persistDocumentFile(DocumentType.ORDER, id, file)
  }

  @Post(':id/timeline')
  async appendOrderTimelineEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      type?: string
      message?: string
      actor?: string | null
      timestamp?: string | Date
      metadata?: Record<string, unknown> | string | null
    },
  ) {
    const type = body.type?.trim()?.toUpperCase()
    if (!type) {
      throw new BadRequestException('orders.timeline.validation.typeRequired')
    }
    const allowed = new Set(['NOTE', 'STATUS_CHANGED', 'OTHER'])
    if (!allowed.has(type)) {
      throw new BadRequestException('orders.timeline.validation.unsupportedType')
    }
    const timeline = await this.timeline.getOrderTimeline(id)
    if (!timeline || timeline.order.documentType !== DocumentType.ORDER) {
      throw new NotFoundException('sales.orders.validation.notFound')
    }
    const event = await this.timeline.appendNote(id, {
      type,
      timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
      actor: body.actor?.trim() || 'admin',
      message: body.message ?? null,
      metadata: body.metadata ?? null,
    })
    return event
  }
}
