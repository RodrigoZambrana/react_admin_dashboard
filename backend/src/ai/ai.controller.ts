import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { EventType } from '@prisma/client'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { KnowledgeService } from '../knowledge/knowledge.service'
import { canUseTool, normalizeAiConversationRole } from './role-engine'
import { AiService } from './ai.service'
import { CreateAiAppointmentDto } from './dto/create-ai-appointment.dto'
import { CreateAiCategoryDto } from './dto/create-ai-category.dto'
import { CreateAiCustomerDto } from './dto/create-ai-customer.dto'
import { CreateAiOrderDto, GenerateAiQuoteDto } from './dto/create-ai-order.dto'
import { CreateAiPaymentDto } from './dto/create-ai-payment.dto'
import { CreateAiProductDto } from './dto/create-ai-product.dto'
import { PreviewAiProductQuoteDto } from './dto/preview-ai-product-quote.dto'
import { GetOwnedCustomerDocumentDto } from './dto/get-owned-customer-document.dto'
import { AdjustAiProductStockDto } from './dto/adjust-ai-product-stock.dto'
import { ListAiAppointmentsDto } from './dto/list-ai-appointments.dto'
import { ListAiCategoriesDto } from './dto/list-ai-categories.dto'
import { ListAiCustomersDto } from './dto/list-ai-customers.dto'
import { ListAiOrdersDto } from './dto/list-ai-orders.dto'
import { ListAiPaymentsDto } from './dto/list-ai-payments.dto'
import { ListAiProductsDto } from './dto/list-ai-products.dto'
import { ParseAiAberturasDto } from './dto/parse-ai-aberturas.dto'
import { PrepareAiAberturasInsertDto } from './dto/prepare-ai-aberturas-insert.dto'
import { PrepareAiAberturasQuoteDto } from './dto/prepare-ai-aberturas-quote.dto'
import { UpdateAiAppointmentDto } from './dto/update-ai-appointment.dto'
import { UpdateAiCategoryDto } from './dto/update-ai-category.dto'
import { UpdateAiCustomerDto } from './dto/update-ai-customer.dto'
import { UpdateAiDocumentCommentDto } from './dto/update-ai-document-comment.dto'
import { UpdateAiDocumentStructureDto } from './dto/update-ai-document-structure.dto'
import { UpdateAiPaymentDto } from './dto/update-ai-payment.dto'
import { UpdateAiProductDto } from './dto/update-ai-product.dto'
import { UpdateAiDocumentStatusDto } from './dto/update-ai-document-status.dto'
import { UpdateAiPaymentStatusDto } from './dto/update-ai-payment-status.dto'
import { UpdateAiRuntimeConfigDto } from './dto/update-ai-runtime-config.dto'
import { ExtractAiAssetsDto } from './dto/extract-ai-assets.dto'
import { AiAssetExtractionService } from './extraction/ai-asset-extraction.service'

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly config: ConfigService,
    private readonly knowledge: KnowledgeService,
    private readonly assetExtraction: AiAssetExtractionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('runtime-config')
  getRuntimeConfig() {
    return this.ai.getRuntimeConfigSummary()
  }

  @UseGuards(JwtAuthGuard)
  @Put('runtime-config')
  updateRuntimeConfig(@Body() body: UpdateAiRuntimeConfigDto) {
    return this.ai.updateRuntimeConfig(body)
  }

  @Get('runtime-config/internal')
  getRuntimeConfigInternal(@Headers('x-ai-internal-token') token?: string) {
    this.assertInternalToken(token)
    return this.ai.getRuntimeConfigInternal()
  }

  @Get('actions')
  listActions(@Headers('x-ai-internal-token') token?: string) {
    this.assertInternalToken(token)
    return this.ai.listActions()
  }

  @UseGuards(JwtAuthGuard)
  @Get('actions/catalog')
  listActionsCatalog() {
    return this.ai.listActions()
  }

  @Get('knowledge/retrieve')
  retrieveKnowledge(
    @Query('query') query: string,
    @Query('tenantKey') tenantKey?: string,
    @Query('scope') scope?: string,
    @Query('limit') limit?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.knowledge.retrieve({
      query,
      tenantKey,
      scope,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('knowledge/topic-taxonomy')
  getKnowledgeTopicTaxonomy(
    @Query('tenantKey') tenantKey?: string,
    @Query('scope') scope?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.knowledge.getTopicTaxonomy({
      tenantKey,
      scope: scope?.trim() === 'admin_internal' ? 'admin_internal' : 'customer_public',
    })
  }

  @Get('knowledge/quote-profiles')
  getKnowledgeQuoteProfiles(
    @Query('tenantKey') tenantKey?: string,
    @Query('scope') scope?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.knowledge.getQuoteProfiles({
      tenantKey,
      scope: scope?.trim() === 'admin_internal' ? 'admin_internal' : 'customer_public',
    })
  }

  @Get('customer-documents/lookup')
  getOwnedCustomerDocument(
    @Query() query: GetOwnedCustomerDocumentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertAuthenticatedCustomerInternalAccess(token, role)
    return this.ai.getOwnedCustomerDocument(query)
  }

  @Post('assets/extract')
  extractAssets(
    @Body() body: ExtractAiAssetsDto,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToken(token)
    return this.assetExtraction.extractMany(body.assets)
  }

  @Get('products')
  listProducts(
    @Query() query: ListAiProductsDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'search_products')
    return this.ai.listProducts(query, role)
  }

  @Post('products/quote-preview')
  previewProductQuote(
    @Body() body: PreviewAiProductQuoteDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'search_products')
    return this.ai.previewProductQuote(body)
  }

  @Get('categories')
  listCategories(
    @Query() query: ListAiCategoriesDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'search_categories')
    return this.ai.listCategories(query)
  }

  @Get('customers')
  listCustomers(
    @Query() query: ListAiCustomersDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'search_customers')
    return this.ai.listCustomers(query)
  }

  @Post('customers')
  createCustomer(
    @Body() body: CreateAiCustomerDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'create_customer')
    return this.ai.createCustomer(body)
  }

  @Put('customers/:id')
  updateCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiCustomerDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_customer')
    return this.ai.updateCustomer(id, body)
  }

  @Get('appointments')
  listAppointments(
    @Query() query: ListAiAppointmentsDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'search_appointments')
    return this.ai.listAppointments(query)
  }

  @Get('customer-appointments')
  listCustomerAppointments(
    @Query() query: ListAiAppointmentsDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertCustomerScheduleInternalAccess(token, role)
    return this.ai.listAppointments(query)
  }

  @Post('appointments')
  createAppointment(
    @Body() body: CreateAiAppointmentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'create_appointment')
    return this.ai.createAppointment(body)
  }

  @Post('customer-appointments')
  createCustomerAppointment(
    @Body() body: CreateAiAppointmentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertCustomerScheduleInternalAccess(token, role)
    return this.ai.createAppointment({
      ...body,
      type: EventType.MEETING,
      metadata: {
        ...(body?.metadata ?? {}),
        scheduleKind: 'customer_technical_visit',
      },
    })
  }

  @Put('appointments/:id')
  updateAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiAppointmentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_appointment')
    return this.ai.updateAppointment(id, body)
  }

  @Delete('appointments/:id')
  deleteAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'delete_appointment')
    return this.ai.deleteAppointment(id)
  }

  @Post('products')
  createProduct(
    @Body() body: CreateAiProductDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'create_product')
    return this.ai.createProduct(body)
  }

  @Post('categories')
  createCategory(
    @Body() body: CreateAiCategoryDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'create_category')
    return this.ai.createCategory(body)
  }

  @Put('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiCategoryDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_category')
    return this.ai.updateCategory(id, body)
  }

  @Put('products/:id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiProductDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_product')
    return this.ai.updateProduct(id, body)
  }

  @Post('products/:id/adjust-stock')
  adjustProductStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdjustAiProductStockDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'adjust_product_stock')
    return this.ai.adjustProductStock(id, body)
  }

  @Post('products/:id/archive')
  archiveProduct(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'archive_product')
    return this.ai.archiveProduct(id)
  }

  @Post('products/:id/publish')
  publishProduct(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'publish_product')
    return this.ai.publishProduct(id)
  }

  @Get('orders')
  listOrders(
    @Query() query: ListAiOrdersDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(
      token,
      role,
      query.documentType === 'BUDGET' ? 'search_quotes' : 'search_orders',
    )
    return this.ai.listOrders(query)
  }

  @Post('orders')
  createOrder(
    @Body() body: CreateAiOrderDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'create_order')
    return this.ai.createOrder(body)
  }

  @Put('orders/:id/status')
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiDocumentStatusDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_order_status')
    return this.ai.updateOrderStatus(id, body)
  }

  @Put('orders/:id/comment')
  updateOrderComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiDocumentCommentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_order_comment')
    return this.ai.updateOrderComment(id, body)
  }

  @Put('orders/:id')
  updateOrderStructure(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiDocumentStructureDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_order_structure')
    return this.ai.updateOrderStructure(id, body)
  }

  @Post('quotes')
  generateQuote(
    @Body() body: GenerateAiQuoteDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'create_quote')
    return this.ai.generateQuote(body)
  }

  @Put('quotes/:id/status')
  updateQuoteStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiDocumentStatusDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_quote_status')
    return this.ai.updateQuoteStatus(id, body)
  }

  @Put('quotes/:id/comment')
  updateQuoteComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiDocumentCommentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_quote_comment')
    return this.ai.updateQuoteComment(id, body)
  }

  @Put('quotes/:id')
  updateQuoteStructure(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiDocumentStructureDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_quote_structure')
    return this.ai.updateQuoteStructure(id, body)
  }

  @Post('quotes/:id/send')
  sendQuote(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'send_quote')
    return this.ai.sendQuote(id)
  }

  @Post('quotes/:id/confirm')
  confirmQuote(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'confirm_quote')
    return this.ai.confirmQuote(id)
  }

  @Get('payments')
  listPayments(
    @Query() query: ListAiPaymentsDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'search_payments')
    return this.ai.listPayments(query)
  }

  @Put('payments/:id/status')
  updatePaymentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiPaymentStatusDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_payment_status')
    return this.ai.updatePaymentStatus(id, body)
  }

  @Put('payments/:id')
  updatePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAiPaymentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'update_payment')
    return this.ai.updatePayment(id, body)
  }

  @Post('aberturas/parse')
  parseAberturas(
    @Body() body: ParseAiAberturasDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'parse_aberturas')
    return this.ai.parseAberturas(body)
  }

  @Post('aberturas/prepare-quote')
  prepareAberturasQuote(
    @Body() body: PrepareAiAberturasQuoteDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'prepare_aberturas_quote')
    return this.ai.prepareAberturasQuote(body)
  }

  @Post('aberturas/prepare-insert')
  prepareAberturasInsert(
    @Body() body: PrepareAiAberturasInsertDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'prepare_aberturas_insert')
    return this.ai.prepareAberturasInsert(body)
  }

  @Post('payments')
  createPayment(
    @Body() body: CreateAiPaymentDto,
    @Headers('x-ai-role') role?: string,
    @Headers('x-ai-internal-token') token?: string,
  ) {
    this.assertInternalToolAccess(token, role, 'create_payment')
    return this.ai.createPayment(body)
  }

  private assertInternalToken(token?: string) {
    const expected =
      this.config.get<string>('AI_INTERNAL_TOKEN') ||
      'local-ai-internal-token'
    if (!token || token !== expected) {
      throw new UnauthorizedException('ai.unauthorized')
    }
  }

  private assertInternalToolAccess(
    token: string | undefined,
    roleHeader: string | undefined,
    toolName: string,
  ) {
    this.assertInternalToken(token)

    const role = normalizeAiConversationRole(roleHeader)
    if (!role) {
      throw new ForbiddenException('ai.role_missing')
    }

    if (!canUseTool(role, toolName)) {
      throw new ForbiddenException('ai.tool_forbidden')
    }
  }

  private assertAuthenticatedCustomerInternalAccess(
    token: string | undefined,
    roleHeader: string | undefined,
  ) {
    this.assertInternalToken(token)

    const role = normalizeAiConversationRole(roleHeader)
    if (role !== 'customer_authenticated') {
      throw new ForbiddenException('ai.customer_scope_forbidden')
    }
  }

  private assertCustomerScheduleInternalAccess(
    token: string | undefined,
    roleHeader: string | undefined,
  ) {
    this.assertInternalToken(token)

    const role = normalizeAiConversationRole(roleHeader)
    if (role !== 'customer_public' && role !== 'customer_authenticated') {
      throw new ForbiddenException('ai.customer_schedule_forbidden')
    }
  }
}
