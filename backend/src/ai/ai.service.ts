import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  DocumentType,
  EventType,
  InstallationChargeScope,
  InstallationResolutionMode,
  PaymentStatus,
  PaymentType,
  Prisma,
  ProductMode,
  ProductType,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { SecureConfigService } from '../common/security/secure-config.service'
import { CurrencyConversionService } from '../common/currency/currency-conversion.service'
import { findOrderStatusById, listOrderStatuses, matchOrderStatus } from '../common/constants/order-statuses'
import { OrderPaymentSettlementService } from '../orders/order-payment-settlement.service'
import { SalesDocumentsService } from '../orders/sales-documents.service'
import { AberturasParserService } from '../aberturas/parser/aberturas-parser.service'
import { normalizeAberturasToken } from '../aberturas/parser/utils'
import { ParametricPricingService } from '../pricing/parametric-pricing.service'
import { resolveEffectiveInstallationPolicy } from '../catalog/installation-policy'
import { M2DerivedProductsService } from '../storefront/m2-derived-products.service'
import { CreateOrderDto } from '../sales/dto/order.dto'
import { CreateAiCategoryDto } from './dto/create-ai-category.dto'
import { CreateAiAppointmentDto } from './dto/create-ai-appointment.dto'
import { CreateAiCustomerDto } from './dto/create-ai-customer.dto'
import { CreateAiOrderDto, GenerateAiQuoteDto } from './dto/create-ai-order.dto'
import { CreateAiPaymentDto } from './dto/create-ai-payment.dto'
import { CreateAiProductDto } from './dto/create-ai-product.dto'
import { PreviewAiProductQuoteDto } from './dto/preview-ai-product-quote.dto'
import { GetOwnedCustomerDocumentDto } from './dto/get-owned-customer-document.dto'
import { ListAiAppointmentsDto } from './dto/list-ai-appointments.dto'
import { ListAiCategoriesDto } from './dto/list-ai-categories.dto'
import { ListAiCustomersDto } from './dto/list-ai-customers.dto'
import { ListAiOrdersDto } from './dto/list-ai-orders.dto'
import { ListAiPaymentsDto } from './dto/list-ai-payments.dto'
import { ListAiProductsDto } from './dto/list-ai-products.dto'
import { AdjustAiProductStockDto } from './dto/adjust-ai-product-stock.dto'
import { ParseAiAberturasDto } from './dto/parse-ai-aberturas.dto'
import { PrepareAiAberturasInsertDto } from './dto/prepare-ai-aberturas-insert.dto'
import { PrepareAiAberturasQuoteDto } from './dto/prepare-ai-aberturas-quote.dto'
import { UpdateAiAppointmentDto } from './dto/update-ai-appointment.dto'
import { UpdateAiCategoryDto } from './dto/update-ai-category.dto'
import { UpdateAiCustomerDto } from './dto/update-ai-customer.dto'
import { UpdateAiDocumentCommentDto } from './dto/update-ai-document-comment.dto'
import { UpdateAiDocumentStructureDto } from './dto/update-ai-document-structure.dto'
import { UpdateAiDocumentStatusDto } from './dto/update-ai-document-status.dto'
import { UpdateAiPaymentDto } from './dto/update-ai-payment.dto'
import { UpdateAiPaymentStatusDto } from './dto/update-ai-payment-status.dto'
import { UpdateAiProductDto } from './dto/update-ai-product.dto'
import { UpdateAiRuntimeConfigDto } from './dto/update-ai-runtime-config.dto'
import {
  AI_CONVERSATION_ROLES,
  type AiConversationRole,
  getAiRoleConfig,
  listAiRoleConfigs,
} from './role-engine'

type AiActionCatalogEntry = {
  key: string
  label: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  confirmationRequired: boolean
  scope: 'customer_public' | 'customer_authenticated' | 'admin_internal'
  allowedRoles?: AiConversationRole[]
  toolName?: string
  keywords?: string[]
  requiredFields?: string[]
  supportedFields?: string[]
  allowedValues?: string[]
  validationRules?: string[]
  confirmationPrompt?: string
}

type StoredAiRuntimeWordingEntry =
  | string
  | string[]
  | {
      messages: string | string[]
      goal?: string | null
      mustAskQuestion?: boolean
      maxChars?: number | null
      allowHybridRewrite?: boolean
      channels?: Record<string, StoredAiRuntimeWordingEntry>
      channelProfiles?: Record<string, StoredAiRuntimeWordingEntry>
      profiles?: Record<string, StoredAiRuntimeWordingEntry>
    }

type StoredAiRuntimeConfig = {
  enabled: boolean
  provider: 'mock' | 'openai' | 'ollama'
  model: string
  openAiApiKey?: string | null
  monthlySpendingLimitUsd?: number | null
  currentUsageUsd?: number | null
  warningThresholdPercent: number
  usageMessage?: string | null
  adminInternalPrompt?: string | null
  customerPublicPrompt?: string | null
  customerGreetingDefault?: string | null
  customerGreetingMorning?: string | null
  customerGreetingAfternoon?: string | null
  customerGreetingConsultation?: string | null
  customerGreetingHelp?: string | null
  adminGreetingDefault?: string | null
  customerGroundedRewriteEnabled?: boolean
  customerGroundedRewriteMaxChars?: number | null
  customerCapabilityProfile?:
    | 'full_assistant'
    | 'ecommerce_content'
    | 'scheduling_content'
    | 'content_only'
    | 'custom'
  customerContentMode?: 'enabled' | 'deterministic_only' | 'handoff_only'
  customerCommerceMode?: 'enabled' | 'deterministic_only' | 'handoff_only'
  customerSchedulingMode?: 'enabled' | 'deterministic_only' | 'handoff_only'
  customerDecisionAssistEnabled?: boolean
  customerDecisionAssistMinConfidence?: number | null
  customerWordingRegistry?: Record<string, StoredAiRuntimeWordingEntry> | null
  customerWordingOverrides?: Record<string, StoredAiRuntimeWordingEntry> | null
  customerHybridIntentRegistry?:
    | Array<{
        id?: string
        intent: string
        confidence?: number
        priority?: number
        examples?: string[]
        includesAny?: string[]
        includesAll?: string[]
        regexAny?: string[]
        regexAll?: string[]
        decisionPath?: string[]
      }>
    | null
}

@Injectable()
export class AiService {
  static readonly AI_RUNTIME_CONFIG_KEY = 'AI_RUNTIME_CONFIG'

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
    private readonly currencyConversion: CurrencyConversionService,
    private readonly salesDocuments: SalesDocumentsService,
    private readonly paymentSettlement: OrderPaymentSettlementService,
    private readonly aberturasParser: AberturasParserService,
    private readonly parametricPricing: ParametricPricingService,
    private readonly m2DerivedProducts: M2DerivedProductsService,
  ) {}

  private normalizeRuntimeWordingEntry(
    rawValue: unknown,
  ): Exclude<StoredAiRuntimeWordingEntry, string | string[]> | string | string[] | null {
    if (typeof rawValue === 'string') {
      const normalizedValue = rawValue.trim()
      return normalizedValue ? normalizedValue : null
    }

    if (Array.isArray(rawValue)) {
      const normalizedValues = rawValue
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
      return normalizedValues.length ? normalizedValues : null
    }

    if (!rawValue || typeof rawValue !== 'object') {
      return null
    }

    const normalizedMessages = Array.isArray((rawValue as { messages?: unknown }).messages)
      ? ((rawValue as { messages?: unknown }).messages as unknown[])
          .filter((entry) => typeof entry === 'string')
          .map((entry) => String(entry).trim())
          .filter(Boolean)
      : typeof (rawValue as { messages?: unknown }).messages === 'string'
        ? [String((rawValue as { messages?: string }).messages).trim()].filter(Boolean)
        : []

    if (!normalizedMessages.length) {
      return null
    }

    const normalizedChannels = this.normalizeRuntimeWordingRegistry(
      (rawValue as { channels?: unknown }).channels,
    )
    const normalizedChannelProfiles = this.normalizeRuntimeWordingRegistry(
      (rawValue as { channelProfiles?: unknown; profiles?: unknown }).channelProfiles ??
        (rawValue as { profiles?: unknown }).profiles,
    )

    return {
      messages: normalizedMessages,
      goal:
        typeof (rawValue as { goal?: unknown }).goal === 'string' &&
        String((rawValue as { goal?: string }).goal).trim()
          ? String((rawValue as { goal?: string }).goal).trim()
          : null,
      mustAskQuestion: (rawValue as { mustAskQuestion?: unknown }).mustAskQuestion === true,
      maxChars:
        Number.isFinite(Number((rawValue as { maxChars?: unknown }).maxChars)) &&
        Number((rawValue as { maxChars?: unknown }).maxChars) > 0
          ? Math.max(80, Math.min(400, Number((rawValue as { maxChars?: unknown }).maxChars)))
          : null,
      allowHybridRewrite:
        (rawValue as { allowHybridRewrite?: unknown }).allowHybridRewrite === true,
      ...(normalizedChannels ? { channels: normalizedChannels } : {}),
      ...(normalizedChannelProfiles ? { channelProfiles: normalizedChannelProfiles } : {}),
    }
  }

  private normalizeRuntimeWordingRegistry(
    value: unknown,
  ): StoredAiRuntimeConfig['customerWordingRegistry'] | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    const entries: Array<
      [
        string,
        NonNullable<StoredAiRuntimeConfig['customerWordingRegistry']>[string],
      ]
    > = []

    for (const [key, rawValue] of Object.entries(value)) {
      const normalizedKey = String(key || '').trim()
      if (!normalizedKey) {
        continue
      }

      const normalizedEntry = this.normalizeRuntimeWordingEntry(rawValue)
      if (normalizedEntry) {
        entries.push([normalizedKey, normalizedEntry])
      }
    }

    return entries.length ? Object.fromEntries(entries) : null
  }

  private parseRuntimeWordingRegistryJson(
    value: string | null | undefined,
  ): StoredAiRuntimeConfig['customerWordingRegistry'] | null | undefined {
    if (value === undefined) {
      return undefined
    }

    const trimmed = String(value || '').trim()
    if (!trimmed) {
      return null
    }

    try {
      const parsed = JSON.parse(trimmed)
      return this.normalizeRuntimeWordingRegistry(parsed)
    } catch (error) {
      throw new BadRequestException('customerWordingRegistryJson.invalid_json')
    }
  }

  private normalizeRuntimeHybridIntentRegistry(
    value: unknown,
  ): StoredAiRuntimeConfig['customerHybridIntentRegistry'] | null {
    const rawRules = Array.isArray(value)
      ? value
      : value && typeof value === 'object' && Array.isArray((value as { rules?: unknown }).rules)
        ? ((value as { rules?: unknown[] }).rules ?? [])
        : []

    const entries = rawRules
      .map((rawRule, index) => {
        if (!rawRule || typeof rawRule !== 'object' || Array.isArray(rawRule)) {
          return null
        }

        const intent =
          typeof (rawRule as { intent?: unknown }).intent === 'string' &&
          String((rawRule as { intent?: string }).intent).trim()
            ? String((rawRule as { intent?: string }).intent).trim()
            : null
        if (!intent) {
          return null
        }

        const normalizeStringArray = (candidate: unknown) =>
          Array.isArray(candidate)
            ? candidate
                .filter((entry) => typeof entry === 'string')
                .map((entry) => String(entry).trim())
                .filter(Boolean)
            : []

        const examples = normalizeStringArray((rawRule as { examples?: unknown }).examples)
        const includesAny = normalizeStringArray((rawRule as { includesAny?: unknown }).includesAny)
        const includesAll = normalizeStringArray((rawRule as { includesAll?: unknown }).includesAll)
        const regexAny = normalizeStringArray((rawRule as { regexAny?: unknown }).regexAny)
        const regexAll = normalizeStringArray((rawRule as { regexAll?: unknown }).regexAll)

        if (
          !examples.length &&
          !includesAny.length &&
          !includesAll.length &&
          !regexAny.length &&
          !regexAll.length
        ) {
          return null
        }

        return {
          id:
            typeof (rawRule as { id?: unknown }).id === 'string' &&
            String((rawRule as { id?: string }).id).trim()
              ? String((rawRule as { id?: string }).id).trim()
              : `runtime_rule_${index + 1}`,
          intent,
          confidence:
            Number.isFinite(Number((rawRule as { confidence?: unknown }).confidence))
              ? Math.max(
                  0,
                  Math.min(1, Number((rawRule as { confidence?: unknown }).confidence)),
                )
              : 0.84,
          priority:
            Number.isFinite(Number((rawRule as { priority?: unknown }).priority))
              ? Number((rawRule as { priority?: unknown }).priority)
              : 50,
          examples,
          includesAny,
          includesAll,
          regexAny,
          regexAll,
          decisionPath: normalizeStringArray(
            (rawRule as { decisionPath?: unknown }).decisionPath,
          ),
        }
      })
      .filter(Boolean)

    return entries.length
      ? (entries as NonNullable<StoredAiRuntimeConfig['customerHybridIntentRegistry']>)
      : null
  }

  private parseRuntimeHybridIntentRegistryJson(
    value: string | null | undefined,
  ): StoredAiRuntimeConfig['customerHybridIntentRegistry'] | null | undefined {
    if (value === undefined) {
      return undefined
    }

    const trimmed = String(value || '').trim()
    if (!trimmed) {
      return null
    }

    try {
      const parsed = JSON.parse(trimmed)
      return this.normalizeRuntimeHybridIntentRegistry(parsed)
    } catch {
      throw new BadRequestException('customerHybridIntentRegistryJson.invalid_json')
    }
  }

  private buildPreviewItemsFromInput(
    input: PreviewAiProductQuoteDto,
  ): Array<{
    quantity: number
    widthMm?: number
    heightMm?: number
    lengthMm?: number
  }> {
    const rawItems =
      Array.isArray(input.items) && input.items.length > 0
        ? input.items
        : [
            {
              widthMm: input.widthMm,
              heightMm: input.heightMm,
              lengthMm: input.lengthMm,
              quantity: input.quantity,
            },
          ]

    return rawItems.map((item) => ({
      quantity: Number(item?.quantity || input.quantity || 1),
      widthMm:
        Number.isFinite(Number(item?.widthMm)) && Number(item?.widthMm) > 0
          ? Number(item?.widthMm)
          : undefined,
      heightMm:
        Number.isFinite(Number(item?.heightMm)) && Number(item?.heightMm) > 0
          ? Number(item?.heightMm)
          : undefined,
      lengthMm:
        Number.isFinite(Number(item?.lengthMm)) && Number(item?.lengthMm) > 0
          ? Number(item?.lengthMm)
          : undefined,
    }))
  }

  private previewServiceProductCharge({
    serviceProduct,
    chargeScope,
    items,
  }: {
    serviceProduct: {
      salePrice: Prisma.Decimal | number
      currency: string
      unitOfMeasure: string | null
    }
    chargeScope: InstallationChargeScope | null
    items: Array<{
      quantity: number
      widthMm?: number
      heightMm?: number
      lengthMm?: number
    }>
  }) {
    const salePrice = this.decimalToNumber(serviceProduct.salePrice)
    if (salePrice === null || !Number.isFinite(salePrice)) {
      return null
    }

    const unitOfMeasure = (serviceProduct.unitOfMeasure || 'UNIT') as
      | 'UNIT'
      | 'SQUARE_METER'
      | 'LINEAR_METER'
    const effectiveChargeScope =
      chargeScope ??
      (unitOfMeasure === 'UNIT'
        ? InstallationChargeScope.PER_QUOTE
        : InstallationChargeScope.MATCH_PRODUCT_MEASUREMENTS)

    const rawItems =
      effectiveChargeScope === InstallationChargeScope.PER_QUOTE
        ? [{ quantity: 1 }]
        : effectiveChargeScope === InstallationChargeScope.MATCH_PRODUCT_QUANTITY
          ? [
              {
                quantity: items.reduce(
                  (sum, entry) => sum + (Number(entry.quantity) || 0),
                  0,
                ) || 1,
              },
            ]
          : items

    const previewItems = rawItems.map((item) => {
      const customAttributes =
        unitOfMeasure === 'SQUARE_METER'
          ? {
              width:
                Number.isFinite(Number(item?.widthMm)) && Number(item?.widthMm) > 0
                  ? Number(item.widthMm) / 1000
                  : undefined,
              height:
                Number.isFinite(Number(item?.heightMm)) && Number(item?.heightMm) > 0
                  ? Number(item.heightMm) / 1000
                  : undefined,
            }
          : unitOfMeasure === 'LINEAR_METER'
            ? {
                length:
                  Number.isFinite(Number(item?.lengthMm)) && Number(item?.lengthMm) > 0
                    ? Number(item.lengthMm) / 1000
                    : undefined,
              }
            : null

      const preview = this.salesDocuments.previewSalesUnitPricing({
        salePrice,
        currency: serviceProduct.currency,
        unitOfMeasure,
        quantity: Number(item?.quantity || 1),
        customAttributes,
      })

      return {
        quantity: preview.quantity,
        measurementPerUnit: preview.measurementPerUnit,
        effectiveQuantity: preview.effectiveQuantity,
        derivedUnitPrice: preview.derivedUnitPrice,
        totalAmount: preview.totalAmount,
        missingMeasurements: preview.missingMeasurements,
      }
    })

    const totalAmount = previewItems.reduce(
      (sum, entry) => sum + (Number(entry.totalAmount) || 0),
      0,
    )

    return {
      chargeScope: effectiveChargeScope,
      unitOfMeasure,
      currency: serviceProduct.currency,
      unitAmount: salePrice,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
      needsMeasurements:
        unitOfMeasure !== 'UNIT' &&
        previewItems.some((entry) => Boolean(entry.missingMeasurements)),
      items: previewItems,
    }
  }

  listActions(): AiActionCatalogEntry[] {
    const actions: AiActionCatalogEntry[] = [
      {
        key: 'products.search',
        label: 'Search products',
        method: 'GET',
        path: '/api/ai/products',
        confirmationRequired: false,
        scope: 'customer_public',
      },
      {
        key: 'categories.search',
        label: 'Search categories',
        method: 'GET',
        path: '/api/ai/categories',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'search_categories',
        keywords: ['buscar categoria', 'buscar categoría', 'listar categorias', 'listar categorías'],
      },
      {
        key: 'orders.search',
        label: 'Search orders',
        method: 'GET',
        path: '/api/ai/orders',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'search_orders',
        keywords: ['buscar pedido', 'buscar orden', 'listar pedidos'],
      },
      {
        key: 'quotes.search',
        label: 'Search quotes',
        method: 'GET',
        path: '/api/ai/orders?documentType=BUDGET',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'search_quotes',
        keywords: ['buscar presupuesto', 'buscar cotizacion', 'buscar cotización', 'listar presupuestos'],
      },
      {
        key: 'payments.search',
        label: 'Search payments',
        method: 'GET',
        path: '/api/ai/payments',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'search_payments',
        keywords: ['buscar pago', 'listar pagos', 'buscar cobro'],
      },
      {
        key: 'customers.search',
        label: 'Search customers',
        method: 'GET',
        path: '/api/ai/customers',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'search_customers',
        keywords: ['buscar cliente', 'encontrar cliente', 'listar clientes'],
      },
      {
        key: 'customers.create',
        label: 'Create or update customer',
        method: 'POST',
        path: '/api/ai/customers',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_customer',
        keywords: ['crear cliente', 'alta de cliente', 'nuevo cliente'],
        requiredFields: ['name'],
        supportedFields: [
          'name',
          'firstName',
          'lastName',
          'email',
          'phoneNumber',
          'location',
          'title',
          'preferredLocale',
        ],
        validationRules: [
          'No pedir confirmación final si el email tiene formato dudoso o inválido.',
          'No pedir confirmación final si el teléfono parece incompleto, ambiguo o no cumple formato esperado.',
          'Si el usuario envía una dirección libre, intentar guardarla como location solo si queda entendible; si no, pedir aclaración.',
          'Si faltan datos clave o hay campos dudosos, listarlos primero y pedir corrección antes de confirmar.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá nombre del cliente y, si aplica, email, teléfono y ubicación. Si hay campos dudosos o mal formateados, corregilos primero y no confirmes todavía.',
      },
      {
        key: 'customers.update',
        label: 'Update customer',
        method: 'PUT',
        path: '/api/ai/customers/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_customer',
        keywords: ['editar cliente', 'actualizar cliente', 'modificar cliente'],
        requiredFields: ['id'],
        supportedFields: [
          'id',
          'name',
          'firstName',
          'lastName',
          'email',
          'phoneNumber',
          'location',
          'title',
          'preferredLocale',
        ],
        validationRules: [
          'Buscar primero el cliente si la referencia es ambigua.',
          'No confirmar cambios con email o teléfono dudosos.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el cliente objetivo y los campos a modificar.',
      },
      {
        key: 'appointments.search',
        label: 'Search appointments',
        method: 'GET',
        path: '/api/ai/appointments',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'search_appointments',
        keywords: ['buscar actividad', 'buscar cita', 'listar actividades', 'listar citas'],
      },
      {
        key: 'appointments.create',
        label: 'Create appointment',
        method: 'POST',
        path: '/api/ai/appointments',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_appointment',
        keywords: ['agendar cita', 'crear cita', 'agendar visita', 'agendar'],
        requiredFields: ['title', 'startAt'],
        supportedFields: [
          'title',
          'description',
          'startAt',
          'endAt',
          'type',
          'location',
          'customerId',
          'projectId',
          'taskId',
        ],
        validationRules: [
          'No confirmar si la fecha/hora es ambigua.',
          'Si hay endAt, no puede ser anterior a startAt.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá título, fecha/hora de inicio y ubicación o contexto si aplica.',
      },
      {
        key: 'appointments.update',
        label: 'Update appointment',
        method: 'PUT',
        path: '/api/ai/appointments/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_appointment',
        keywords: ['editar actividad', 'actualizar actividad', 'editar cita', 'mover cita'],
        requiredFields: ['id'],
        supportedFields: ['id', 'title', 'description', 'startAt', 'endAt', 'type', 'location'],
        validationRules: [
          'Buscar primero la actividad si la referencia no es exacta.',
          'No confirmar si la nueva fecha/hora es ambigua o inconsistente.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá la actividad objetivo y qué campos deben cambiar.',
      },
      {
        key: 'appointments.delete',
        label: 'Delete appointment',
        method: 'DELETE',
        path: '/api/ai/appointments/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'delete_appointment',
        keywords: ['eliminar actividad', 'borrar actividad', 'cancelar actividad', 'eliminar cita'],
        requiredFields: ['id'],
        supportedFields: ['id'],
        validationRules: [
          'Buscar y mostrar primero la actividad objetivo antes de pedir confirmación final.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá explícitamente que querés eliminar la actividad indicada.',
      },
      {
        key: 'products.create',
        label: 'Create product',
        method: 'POST',
        path: '/api/ai/products',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_product',
        keywords: ['crear producto', 'alta de producto', 'nuevo producto'],
        requiredFields: ['name'],
        supportedFields: [
          'name',
          'productCode',
          'description',
          'categoryId',
          'productType',
          'mode',
          'salePrice',
          'costPrice',
          'currency',
          'unitOfMeasure',
          'stock',
          'published',
        ],
        validationRules: [
          'No confirmar si falta moneda cuando hay precio.',
          'No confirmar si el precio parece inconsistente o negativo.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá nombre del producto, moneda y precio de venta. Si corresponde, agregá categoría, modo y stock.',
      },
      {
        key: 'products.update',
        label: 'Update product',
        method: 'PUT',
        path: '/api/ai/products/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_product',
        keywords: ['editar producto', 'actualizar producto', 'modificar producto'],
        requiredFields: ['id'],
        supportedFields: [
          'id',
          'name',
          'productCode',
          'description',
          'categoryId',
          'productType',
          'mode',
          'salePrice',
          'costPrice',
          'currency',
          'unitOfMeasure',
          'stock',
          'published',
        ],
        validationRules: [
          'Buscar primero el producto si la referencia es ambigua.',
          'No confirmar cambios de precio con moneda faltante o inconsistente.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el producto objetivo y los cambios a aplicar.',
      },
      {
        key: 'products.adjust_stock',
        label: 'Adjust product stock',
        method: 'POST',
        path: '/api/ai/products/:id/adjust-stock',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'adjust_product_stock',
        keywords: ['ajustar stock', 'sumar stock', 'restar stock', 'cambiar stock'],
        requiredFields: ['id'],
        supportedFields: ['id', 'delta', 'stock'],
        validationRules: [
          'Buscar primero el producto si la referencia es ambigua.',
          'Usar delta o stock absoluto, pero no ambos al mismo tiempo.',
          'No confirmar si el ajuste deja stock negativo.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el producto objetivo y si el ajuste es por delta o por stock absoluto.',
      },
      {
        key: 'products.archive',
        label: 'Archive product',
        method: 'POST',
        path: '/api/ai/products/:id/archive',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'archive_product',
        keywords: ['archivar producto', 'despublicar producto', 'desactivar producto'],
        requiredFields: ['id'],
        supportedFields: ['id'],
        validationRules: [
          'Buscar y mostrar primero el producto objetivo antes de pedir confirmación final.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá que querés archivar o despublicar el producto indicado.',
      },
      {
        key: 'products.publish',
        label: 'Publish product',
        method: 'POST',
        path: '/api/ai/products/:id/publish',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'publish_product',
        keywords: ['publicar producto', 'activar producto', 'volver a publicar producto'],
        requiredFields: ['id'],
        supportedFields: ['id'],
        validationRules: [
          'Buscar y mostrar primero el producto objetivo antes de pedir confirmación final.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá que querés publicar el producto indicado.',
      },
      {
        key: 'categories.create',
        label: 'Create category',
        method: 'POST',
        path: '/api/ai/categories',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_category',
        keywords: ['crear categoria', 'crear categoría', 'nueva categoria', 'nueva categoría'],
        requiredFields: ['name'],
        supportedFields: ['name', 'description', 'parentId'],
        validationRules: [
          'Buscar primero categorías parecidas para evitar duplicados.',
          'Si la categoría padre es ambigua, pedir aclaración antes de confirmar.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá nombre de la categoría y categoría padre si corresponde.',
      },
      {
        key: 'categories.update',
        label: 'Update category',
        method: 'PUT',
        path: '/api/ai/categories/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_category',
        keywords: ['editar categoria', 'editar categoría', 'actualizar categoria', 'actualizar categoría'],
        requiredFields: ['id'],
        supportedFields: ['id', 'name', 'description', 'parentId'],
        validationRules: [
          'Buscar primero la categoría si la referencia es ambigua.',
          'Si el padre es ambiguo, pedir aclaración antes de confirmar.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá la categoría objetivo y los cambios a aplicar.',
      },
      {
        key: 'orders.create',
        label: 'Create order',
        method: 'POST',
        path: '/api/ai/orders',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_order',
        keywords: ['crear pedido', 'crear orden', 'nuevo pedido'],
        requiredFields: ['customerId', 'items'],
        supportedFields: [
          'customerId',
          'currency',
          'comment',
          'shippingAddress1',
          'shippingAddress2',
          'shippingCity',
          'shippingDepartment',
          'shippingNeighborhood',
          'shippingZip',
          'shippingCountry',
          'deliveryFees',
          'items',
        ],
        validationRules: [
          'Buscar primero el cliente si no hay customerId confirmado.',
          'No confirmar si faltan items o moneda.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá cliente, moneda, items y cualquier cargo de entrega.',
      },
      {
        key: 'orders.update_status',
        label: 'Update order status',
        method: 'PUT',
        path: '/api/ai/orders/:id/status',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_order_status',
        keywords: ['cambiar estado del pedido', 'actualizar estado del pedido', 'marcar pedido como'],
        requiredFields: ['id', 'status'],
        supportedFields: ['id', 'status', 'force'],
        allowedValues: listOrderStatuses(DocumentType.ORDER).map((status) => status.code),
        validationRules: [
          'Buscar primero el pedido si la referencia es ambigua.',
          'Solo aceptar estados válidos del flujo real: pending, paid, cancelled, delivered.',
          'No confirmar si el estado pedido no coincide con un estado soportado.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el pedido objetivo y el nuevo estado real a aplicar.',
      },
      {
        key: 'orders.update_comment',
        label: 'Update order note',
        method: 'PUT',
        path: '/api/ai/orders/:id/comment',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_order_comment',
        keywords: ['agregar nota al pedido', 'actualizar nota del pedido', 'comentario del pedido', 'nota de pedido'],
        requiredFields: ['id', 'comment'],
        supportedFields: ['id', 'comment'],
        validationRules: [
          'Buscar primero el pedido si la referencia es ambigua.',
          'No confirmar si el comentario queda vacío.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el pedido objetivo y la nota a guardar.',
      },
      {
        key: 'orders.update_structure',
        label: 'Update order items and shipping',
        method: 'PUT',
        path: '/api/ai/orders/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_order_structure',
        keywords: [
          'editar pedido',
          'actualizar pedido',
          'modificar pedido',
          'agregar item al pedido',
          'quitar item del pedido',
          'cambiar envio del pedido',
          'cambiar envío del pedido',
        ],
        requiredFields: ['id'],
        supportedFields: [
          'id',
          'currency',
          'comment',
          'shippingAddress1',
          'shippingAddress2',
          'shippingCity',
          'shippingDepartment',
          'shippingNeighborhood',
          'shippingZip',
          'shippingCountry',
          'deliveryFees',
          'shippingVendor',
          'estimatedMin',
          'estimatedMax',
          'items',
          'appendItems',
          'removeItemNames',
        ],
        validationRules: [
          'Buscar primero el pedido si la referencia es ambigua.',
          'No confirmar si la edición deja el pedido sin items.',
          'No confirmar si hay cambios de precio sin moneda resuelta.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el pedido objetivo, los cambios de items y cualquier ajuste de envío.',
      },
      {
        key: 'quotes.create',
        label: 'Generate quote',
        method: 'POST',
        path: '/api/ai/quotes',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_quote',
        keywords: ['crear presupuesto', 'generar presupuesto', 'cotizar'],
        requiredFields: ['customerId', 'items'],
        supportedFields: [
          'customerId',
          'currency',
          'comment',
          'shippingAddress1',
          'shippingAddress2',
          'shippingCity',
          'shippingDepartment',
          'shippingNeighborhood',
          'shippingZip',
          'shippingCountry',
          'deliveryFees',
          'validForDays',
          'items',
        ],
        validationRules: [
          'Buscar primero el cliente si no hay customerId confirmado.',
          'No confirmar si faltan items, moneda o vigencia cuando sean relevantes.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá cliente, items, moneda y vigencia si aplica.',
      },
      {
        key: 'quotes.send',
        label: 'Send quote',
        method: 'POST',
        path: '/api/ai/quotes/:id/send',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'send_quote',
        keywords: ['enviar presupuesto', 'marcar presupuesto como enviado'],
        requiredFields: ['id'],
        supportedFields: ['id'],
        validationRules: [
          'Buscar primero el presupuesto si la referencia es ambigua.',
          'Usar esta acción cuando el objetivo sea dejarlo en estado enviado y disparar el flujo correspondiente.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el presupuesto objetivo que querés enviar.',
      },
      {
        key: 'quotes.confirm',
        label: 'Confirm quote',
        method: 'POST',
        path: '/api/ai/quotes/:id/confirm',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'confirm_quote',
        keywords: ['confirmar presupuesto', 'aceptar presupuesto', 'convertir presupuesto'],
        requiredFields: ['id'],
        supportedFields: ['id'],
        validationRules: [
          'Buscar primero el presupuesto si la referencia es ambigua.',
          'Usar esta acción cuando la confirmación deba convertir el presupuesto en pedido.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el presupuesto objetivo a convertir o confirmar.',
      },
      {
        key: 'quotes.update_status',
        label: 'Update quote status',
        method: 'PUT',
        path: '/api/ai/quotes/:id/status',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_quote_status',
        keywords: ['cambiar estado del presupuesto', 'actualizar estado del presupuesto', 'marcar presupuesto como'],
        requiredFields: ['id', 'status'],
        supportedFields: ['id', 'status', 'force'],
        allowedValues: listOrderStatuses(DocumentType.BUDGET).map((status) => status.code),
        validationRules: [
          'Buscar primero el presupuesto si la referencia es ambigua.',
          'Solo aceptar estados válidos del flujo real de presupuestos.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el presupuesto objetivo y el nuevo estado.',
      },
      {
        key: 'quotes.update_comment',
        label: 'Update quote note',
        method: 'PUT',
        path: '/api/ai/quotes/:id/comment',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_quote_comment',
        keywords: ['agregar nota al presupuesto', 'actualizar nota del presupuesto', 'comentario del presupuesto', 'nota de presupuesto'],
        requiredFields: ['id', 'comment'],
        supportedFields: ['id', 'comment'],
        validationRules: [
          'Buscar primero el presupuesto si la referencia es ambigua.',
          'No confirmar si el comentario queda vacío.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el presupuesto objetivo y la nota a guardar.',
      },
      {
        key: 'quotes.update_structure',
        label: 'Update quote items shipping and validity',
        method: 'PUT',
        path: '/api/ai/quotes/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_quote_structure',
        keywords: [
          'editar presupuesto',
          'actualizar presupuesto',
          'modificar presupuesto',
          'agregar item al presupuesto',
          'quitar item del presupuesto',
          'cambiar vigencia del presupuesto',
          'cambiar envio del presupuesto',
          'cambiar envío del presupuesto',
        ],
        requiredFields: ['id'],
        supportedFields: [
          'id',
          'currency',
          'comment',
          'shippingAddress1',
          'shippingAddress2',
          'shippingCity',
          'shippingDepartment',
          'shippingNeighborhood',
          'shippingZip',
          'shippingCountry',
          'deliveryFees',
          'shippingVendor',
          'estimatedMin',
          'estimatedMax',
          'validUntilDate',
          'validForDays',
          'items',
          'appendItems',
          'removeItemNames',
        ],
        validationRules: [
          'Buscar primero el presupuesto si la referencia es ambigua.',
          'No confirmar si la edición deja el presupuesto sin items.',
          'No confirmar si la nueva vigencia es ambigua o inconsistente.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el presupuesto objetivo, los cambios de items, envío y vigencia.',
      },
      {
        key: 'payments.create',
        label: 'Create payment',
        method: 'POST',
        path: '/api/ai/payments',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_payment',
        keywords: ['crear pago', 'registrar pago', 'cobrar'],
        requiredFields: ['orderId', 'amount', 'currency'],
        supportedFields: [
          'orderId',
          'amount',
          'currency',
          'type',
          'status',
          'method',
          'reference',
          'notes',
        ],
        validationRules: [
          'Buscar primero el pedido si no hay orderId confirmado.',
          'No confirmar si el monto o la moneda son ambiguos.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá pedido, monto, moneda, método y estado del pago.',
      },
      {
        key: 'payments.update_status',
        label: 'Update payment status',
        method: 'PUT',
        path: '/api/ai/payments/:id/status',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_payment_status',
        keywords: ['cambiar estado del pago', 'actualizar estado del pago', 'marcar pago como'],
        requiredFields: ['id', 'status'],
        supportedFields: ['id', 'status'],
        allowedValues: Object.values(PaymentStatus),
        validationRules: [
          'Buscar primero el pago o el pedido relacionado si la referencia es ambigua.',
          'Solo aceptar estados válidos: REGISTERED, CONFIRMED o FAILED.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el pago objetivo y el nuevo estado.',
      },
      {
        key: 'payments.update',
        label: 'Update payment details',
        method: 'PUT',
        path: '/api/ai/payments/:id',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'update_payment',
        keywords: ['actualizar pago', 'editar pago', 'agregar nota al pago', 'actualizar referencia del pago'],
        requiredFields: ['id'],
        supportedFields: ['id', 'method', 'reference', 'notes'],
        validationRules: [
          'Buscar primero el pago o el pedido relacionado si la referencia es ambigua.',
          'No confirmar si no hay al menos un campo a modificar.',
        ],
        confirmationPrompt:
          'Antes de ejecutar, confirmá el pago objetivo y los campos a modificar.',
      },
      {
        key: 'aberturas.register',
        label: 'Register aberturas into system',
        method: 'POST',
        path: '/api/ai/aberturas/prepare-insert',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'prepare_aberturas_insert',
        keywords: [
          'agregar abertura al sistema',
          'agregar aberturas al sistema',
          'incorporar abertura al sistema',
          'incorporar aberturas al sistema',
          'alta de abertura',
          'alta de aberturas',
          'agregar a la lista de productos',
          'agregar estas aberturas al sistema',
          'registrar abertura',
          'registrar aberturas',
        ],
        requiredFields: ['text'],
        supportedFields: ['text', 'source', 'referenceDate'],
        validationRules: [
          'Tratar la solicitud como normalización para alta y no como cotización.',
          'No inferir ni buscar precio si el texto no trae precio explícito.',
          'Separar campos confirmados, faltantes y dudosos por cada item detectado antes de pedir confirmación.',
          'Entregar payload estructurado listo para insert solo en items válidos.',
        ],
      },
      {
        key: 'aberturas.prepare_quote',
        label: 'Prepare aberturas quote draft',
        method: 'POST',
        path: '/api/ai/aberturas/prepare-quote',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'prepare_aberturas_quote',
        keywords: [
          'cotizar abertura',
          'presupuesto de aberturas',
          'presupuestar abertura',
          'pasame este presupuesto',
          'pásame este presupuesto',
          'cotizacion de aberturas',
          'cotización de aberturas',
        ],
        requiredFields: ['text'],
        supportedFields: ['text', 'source', 'referenceDate'],
        validationRules: [
          'No inventar items ni precios definitivos cuando no haya exact match.',
          'Separar claramente coincidencias exactas, aproximadas y faltantes antes de confirmar una cotización.',
        ],
      },
      {
        key: 'aberturas.parse',
        label: 'Parse aberturas text',
        method: 'POST',
        path: '/api/ai/aberturas/parse',
        confirmationRequired: false,
        scope: 'admin_internal',
        toolName: 'parse_aberturas',
        keywords: [
          'abertura',
          'aberturas',
          'corrediza',
          'batiente',
          'paño fijo',
          'monoblock',
          'mosquitero',
          'dvh',
        ],
        requiredFields: ['text'],
        supportedFields: ['text', 'source', 'referenceDate'],
        validationRules: [
          'No inventar atributos faltantes ni precios definitivos.',
          'Separar campos confirmados, faltantes y dudosos por cada item detectado.',
        ],
      },
    ]

    return actions.map((entry) => this.decorateActionCatalogEntry(entry))
  }

  async listCategories(query: ListAiCategoriesDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const search = query.search?.trim()

    const where: Prisma.ProductCategoryWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}

    const [items, total] = await this.prisma.$transaction([
      this.prisma.productCategory.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          description: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.productCategory.count({ where }),
    ])

    return { items, total, page, pageSize }
  }

  async listProducts(query: ListAiProductsDto, role?: string | null) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const search = query.search?.trim()

    const where: Prisma.ProductWhereInput = {}
    const normalizedRole = AI_CONVERSATION_ROLES.includes(role as AiConversationRole)
      ? (role as AiConversationRole)
      : null
    if (normalizedRole && getAiRoleConfig(normalizedRole).type === 'customer') {
      where.published = true
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { productCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              installationResolutionMode: true,
              installationChargeScope: true,
              installationPricePresentationMode: true,
              installServiceProduct: {
                select: {
                  id: true,
                  name: true,
                  productCode: true,
                  salePrice: true,
                  currency: true,
                  unitOfMeasure: true,
                },
              },
            },
          },
          installServiceProduct: {
            select: {
              id: true,
              name: true,
              productCode: true,
              salePrice: true,
              currency: true,
              unitOfMeasure: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ])

    return {
      items: items.map((product) => ({
        ...((
          policy => ({
            installationResolutionMode: policy.mode,
            installationChargeScope: policy.chargeScope,
            installationPricePresentationMode: policy.pricePresentationMode,
            installationPolicySource: policy.source,
            installServiceProduct: policy.serviceProduct
              ? {
                  id: policy.serviceProduct.id,
                  name: policy.serviceProduct.name,
                  productCode: policy.serviceProduct.productCode,
                  salePrice: this.decimalToNumber(policy.serviceProduct.salePrice),
                  currency: policy.serviceProduct.currency,
                  unitOfMeasure: policy.serviceProduct.unitOfMeasure,
                }
              : null,
          })
        )(resolveEffectiveInstallationPolicy(product))),
        id: product.id,
        name: product.name,
        productCode: product.productCode,
        mode: product.mode,
        productType: product.productType,
        description: product.description,
        currency: product.currency,
        salePrice: Number(product.salePrice),
        costPrice: Number(product.costPrice),
        unitOfMeasure: product.unitOfMeasure,
        stock: product.stock,
        published: product.published,
        category: product.category,
      })),
      total,
      page,
      pageSize,
    }
  }

  async previewProductQuote(input: PreviewAiProductQuoteDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        productCode: true,
        mode: true,
        productType: true,
        unitOfMeasure: true,
        salePrice: true,
        currency: true,
        published: true,
        installationResolutionMode: true,
        installationChargeScope: true,
        installationPricePresentationMode: true,
        installServiceProduct: {
          select: {
            id: true,
            name: true,
            productCode: true,
            salePrice: true,
            currency: true,
            unitOfMeasure: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            installationResolutionMode: true,
            installationChargeScope: true,
            installationPricePresentationMode: true,
            installServiceProduct: {
              select: {
                id: true,
                name: true,
                productCode: true,
                salePrice: true,
                currency: true,
                unitOfMeasure: true,
              },
            },
          },
        },
      },
    })

    if (!product) {
      throw new NotFoundException('product.notFound')
    }

    const unitOfMeasure = product.unitOfMeasure ?? 'UNIT'
    const installationPolicy = resolveEffectiveInstallationPolicy(product)
    const salePrice = this.decimalToNumber(product.salePrice)
    if (salePrice === null || !Number.isFinite(salePrice)) {
      throw new BadRequestException('pricing.preview.invalidSalePrice')
    }
    const targetCurrency =
      this.currencyConversion.normalizeCurrency(input.targetCurrency) ||
      this.currencyConversion.normalizeCurrency(product.currency) ||
      'UYU'
    const sourceCurrency =
      this.currencyConversion.normalizeCurrency(product.currency) || targetCurrency
    const fxCurrencies = new Set<string>([sourceCurrency, targetCurrency])
    if (installationPolicy.serviceProduct?.currency) {
      const normalizedInstallationCurrency = this.currencyConversion.normalizeCurrency(
        installationPolicy.serviceProduct.currency,
      )
      if (normalizedInstallationCurrency) {
        fxCurrencies.add(normalizedInstallationCurrency)
      }
    }
    const fxSnapshot =
      fxCurrencies.size > 1
        ? await this.currencyConversion.buildRatesSnapshot(Array.from(fxCurrencies))
        : null
    const convertAmount = (amount: number | null, fromCurrency?: string | null) => {
      if (!Number.isFinite(Number(amount))) {
        return null
      }
      const normalizedFrom =
        this.currencyConversion.normalizeCurrency(fromCurrency) || targetCurrency
      if (!fxSnapshot || normalizedFrom === targetCurrency) {
        return Number(amount)
      }
      const converted = this.currencyConversion.convertWithSnapshot(
        Number(amount),
        normalizedFrom,
        targetCurrency,
        fxSnapshot,
      )
      return this.decimalToNumber(converted.amount)
    }
    const previewSourceItems = this.buildPreviewItemsFromInput(input)

    const previewItems = previewSourceItems.map((item) => {
      const quantity = Number(item?.quantity || input.quantity || 1)
      const customAttributes =
        unitOfMeasure === 'SQUARE_METER'
          ? {
              width:
                Number.isFinite(Number(item?.widthMm)) && Number(item?.widthMm) > 0
                  ? Number(item.widthMm) / 1000
                  : undefined,
              height:
                Number.isFinite(Number(item?.heightMm)) && Number(item?.heightMm) > 0
                  ? Number(item.heightMm) / 1000
                  : undefined,
            }
          : unitOfMeasure === 'LINEAR_METER'
            ? {
                length:
                  Number.isFinite(Number(item?.lengthMm)) && Number(item?.lengthMm) > 0
                    ? Number(item.lengthMm) / 1000
                    : undefined,
              }
            : null

      const preview = this.salesDocuments.previewSalesUnitPricing({
        salePrice,
        currency: product.currency,
        unitOfMeasure,
        quantity,
        customAttributes,
      })

      return {
        quantity: preview.quantity,
        widthMm:
          Number.isFinite(Number(item?.widthMm)) && Number(item?.widthMm) > 0
            ? Number(item.widthMm)
            : null,
        heightMm:
          Number.isFinite(Number(item?.heightMm)) && Number(item?.heightMm) > 0
            ? Number(item.heightMm)
            : null,
        lengthMm:
          Number.isFinite(Number(item?.lengthMm)) && Number(item?.lengthMm) > 0
            ? Number(item.lengthMm)
            : null,
        measurementPerUnit: preview.measurementPerUnit,
        effectiveQuantity: preview.effectiveQuantity,
        derivedUnitPrice: convertAmount(preview.derivedUnitPrice, product.currency),
        totalAmount: convertAmount(preview.totalAmount, product.currency),
        missingMeasurements: preview.missingMeasurements,
      }
    })

    const hasMissingMeasurements =
      previewItems.some((entry) => entry.missingMeasurements) &&
      unitOfMeasure !== 'UNIT'
    const totalAmount = previewItems.reduce(
      (sum, entry) => sum + (Number(entry.totalAmount) || 0),
      0,
    )
    const effectiveQuantity = previewItems.reduce(
      (sum, entry) => sum + (Number(entry.effectiveQuantity) || 0),
      0,
    )
    const measurementPerUnit =
      previewItems.length === 1
        ? previewItems[0]?.measurementPerUnit ?? null
        : null

    return {
      product: {
        id: product.id,
        name: product.name,
        productCode: product.productCode,
        mode: product.mode,
        unitOfMeasure,
        currency: sourceCurrency,
        targetCurrency,
        published: product.published,
      },
      available:
        product.mode !== ProductMode.PARAMETRIC &&
        !hasMissingMeasurements &&
        previewItems.every((entry) => Number.isFinite(Number(entry.totalAmount))),
      needsConfiguration: hasMissingMeasurements,
      quantity: previewItems.reduce(
        (sum, entry) => sum + (Number(entry.quantity) || 0),
        0,
      ),
      unitAmount: convertAmount(salePrice, product.currency),
      currency: targetCurrency,
      effectiveQuantity:
        Number.isFinite(effectiveQuantity) && effectiveQuantity > 0
          ? effectiveQuantity
          : null,
      measurementPerUnit,
      totalAmount:
        Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : null,
      items: previewItems,
      installationResolutionMode: installationPolicy.mode,
      installationChargeScope: installationPolicy.chargeScope,
      installationPricePresentationMode: installationPolicy.pricePresentationMode,
      installationIncluded: installationPolicy.mode === InstallationResolutionMode.INCLUDED,
      installationRequiresConfirmation:
        installationPolicy.mode === InstallationResolutionMode.UNKNOWN,
      installation: (() => {
        if (
          !installationPolicy.hasServiceProduct ||
          !installationPolicy.serviceProduct
        ) {
          return {
            mode: installationPolicy.mode,
            chargeScope: installationPolicy.chargeScope,
            pricePresentationMode: installationPolicy.pricePresentationMode,
            source: installationPolicy.source,
            included: installationPolicy.mode === InstallationResolutionMode.INCLUDED,
            requiresConfirmation:
              installationPolicy.mode === InstallationResolutionMode.UNKNOWN,
            serviceProduct: null,
            amount: null,
            currency: targetCurrency,
            totalAmountWithInstallation:
              installationPolicy.mode === InstallationResolutionMode.INCLUDED &&
              Number.isFinite(totalAmount) &&
              totalAmount > 0
                ? convertAmount(totalAmount, product.currency)
                : null,
            needsMeasurements: false,
          }
        }

        const installationPreview = this.previewServiceProductCharge({
          serviceProduct: installationPolicy.serviceProduct,
          chargeScope: installationPolicy.chargeScope,
          items: previewSourceItems,
        })
        const installationAmount =
          installationPreview &&
          Number.isFinite(Number(installationPreview.totalAmount)) &&
          Number(installationPreview.totalAmount) > 0
            ? Number(installationPreview.totalAmount)
            : null
        const convertedProductTotal = convertAmount(totalAmount, product.currency)
        const convertedInstallationAmount = convertAmount(
          installationAmount,
          installationPreview?.currency || installationPolicy.serviceProduct.currency,
        )
        const totalAmountWithInstallation =
          Number.isFinite(Number(convertedProductTotal)) && Number(convertedProductTotal) > 0
            ? installationPolicy.mode === InstallationResolutionMode.INCLUDED
              ? Number(convertedProductTotal)
              : convertedInstallationAmount !== null
                ? Number(convertedProductTotal) + Number(convertedInstallationAmount)
                : Number(convertedProductTotal)
            : null

        return {
          mode: installationPolicy.mode,
          chargeScope: installationPreview?.chargeScope ?? installationPolicy.chargeScope,
          pricePresentationMode: installationPolicy.pricePresentationMode,
          source: installationPolicy.source,
          included: installationPolicy.mode === InstallationResolutionMode.INCLUDED,
          requiresConfirmation:
            installationPolicy.mode === InstallationResolutionMode.UNKNOWN,
          serviceProduct: {
            id: installationPolicy.serviceProduct.id,
            name: installationPolicy.serviceProduct.name,
            productCode: installationPolicy.serviceProduct.productCode,
            currency: targetCurrency,
            unitOfMeasure: installationPolicy.serviceProduct.unitOfMeasure,
            unitAmount: convertAmount(
              this.decimalToNumber(installationPolicy.serviceProduct.salePrice),
              installationPolicy.serviceProduct.currency,
            ),
          },
          amount: convertedInstallationAmount,
          currency: targetCurrency,
          totalAmountWithInstallation,
          needsMeasurements: Boolean(installationPreview?.needsMeasurements),
        }
      })(),
    }
  }

  async listCustomers(query: ListAiCustomersDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const search = query.search?.trim()

    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          location: true,
          preferredLocale: true,
          updatedAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ])

    return { items, total, page, pageSize }
  }

  async listOrders(query: ListAiOrdersDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const search = query.search?.trim()

    const where: Prisma.OrderWhereInput = {
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(search
        ? {
            OR: [
              { uuid: { contains: search, mode: 'insensitive' } },
              { comment: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          uuid: true,
          documentType: true,
          orderCurrency: true,
          grandTotal: true,
          comment: true,
          validUntil: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        id: item.id,
        uuid: item.uuid,
        documentType: item.documentType,
        currency: item.orderCurrency,
        grandTotal: Number(item.grandTotal),
        comment: item.comment,
        validUntil: item.validUntil,
        updatedAt: item.updatedAt,
        customer: item.customer,
      })),
      total,
      page,
      pageSize,
    }
  }

  async getOwnedCustomerDocument(query: GetOwnedCustomerDocumentDto) {
    const identifier = query.identifier.trim()
    const lookup = this.buildOwnedCustomerDocumentLookup(
      query.customerId,
      identifier,
      query.documentType,
    )
    if (!lookup) {
      return null
    }

    const item = await this.prisma.order.findFirst({
      where: lookup,
      select: {
        id: true,
        uuid: true,
        documentType: true,
        statusId: true,
        orderCurrency: true,
        grandTotal: true,
        validUntil: true,
        updatedAt: true,
      },
    })

    if (!item) {
      return null
    }

    const status = findOrderStatusById(item.statusId)
    return {
      id: item.id,
      uuid: item.uuid,
      reference: this.buildOwnedCustomerDocumentReference(item.documentType, item.id, item.uuid),
      documentType: item.documentType,
      statusCode: status?.code ?? null,
      statusLabel: status?.label ?? null,
      currency: item.orderCurrency ?? null,
      grandTotal: this.decimalToNumber(item.grandTotal),
      validUntil: item.validUntil,
      updatedAt: item.updatedAt,
    }
  }

  private buildOwnedCustomerDocumentLookup(
    customerId: number,
    identifier: string,
    documentType: DocumentType,
  ): Prisma.OrderWhereInput | null {
    const normalized = identifier.trim()
    if (!normalized) {
      return null
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidPattern.test(normalized)) {
      return {
        customerId,
        documentType,
        uuid: { equals: normalized, mode: 'insensitive' },
      }
    }

    const numericIdentifier =
      normalized.match(/^(?:ord|pedido|orden|bud|presupuesto|cotizacion|cotización)[-:#\s]?0*(\d{1,10})$/i)?.[1] ??
      normalized.match(/^0*(\d{1,10})$/)?.[1] ??
      null

    if (!numericIdentifier) {
      return null
    }

    const id = Number(numericIdentifier)
    if (!Number.isInteger(id) || id <= 0) {
      return null
    }

    return {
      customerId,
      documentType,
      id,
    }
  }

  private buildOwnedCustomerDocumentReference(
    documentType: DocumentType,
    id: number,
    uuid?: string | null,
  ) {
    const normalizedUuid = uuid?.trim()
    if (normalizedUuid) {
      return normalizedUuid
    }
    const prefix = documentType === DocumentType.BUDGET ? 'BUD' : 'ORD'
    return `${prefix}-${id.toString().padStart(6, '0')}`
  }

  async listPayments(query: ListAiPaymentsDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const search = query.search?.trim()

    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: 'insensitive' } },
              { method: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
              { order: { uuid: { contains: search, mode: 'insensitive' } } },
              { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          amount: true,
          currency: true,
          type: true,
          status: true,
          method: true,
          reference: true,
          updatedAt: true,
          order: {
            select: {
              id: true,
              uuid: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        id: item.id,
        amount: Number(item.amount),
        currency: item.currency,
        type: item.type,
        status: item.status,
        method: item.method,
        reference: item.reference,
        updatedAt: item.updatedAt,
        order: item.order,
      })),
      total,
      page,
      pageSize,
    }
  }

  async createCustomer(input: CreateAiCustomerDto) {
    const email = input.email?.trim().toLowerCase() || null
    const phoneNumber = input.phoneNumber?.trim() || null
    const firstStatus = await this.prisma.customerStatus.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true },
    })

    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [email ? { email } : undefined, phoneNumber ? { phoneNumber } : undefined].filter(
          Boolean,
        ) as Prisma.CustomerWhereInput[],
      },
    })

    if (existing) {
      const customer = await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: input.name.trim(),
          firstName: input.firstName?.trim() || existing.firstName,
          lastName: input.lastName?.trim() || existing.lastName,
          email: email ?? existing.email,
          phoneNumber: phoneNumber ?? existing.phoneNumber,
          location: input.location?.trim() || existing.location,
          title: input.title?.trim() || existing.title,
          preferredLocale: input.preferredLocale?.trim() || existing.preferredLocale,
          statusId: existing.statusId ?? firstStatus?.id ?? null,
        },
      })

      return { customer, mode: 'updated' as const }
    }

    const customer = await this.prisma.customer.create({
      data: {
        name: input.name.trim(),
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        email,
        phoneNumber,
        location: input.location?.trim() || null,
        title: input.title?.trim() || null,
        preferredLocale: input.preferredLocale?.trim() || 'es',
        statusId: firstStatus?.id ?? null,
      },
    })

    return { customer, mode: 'created' as const }
  }

  async updateCustomer(id: number, input: UpdateAiCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, location: true, title: true, preferredLocale: true },
    })
    if (!existing) {
      throw new NotFoundException('customer.notFound')
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? undefined,
        firstName: input.firstName?.trim() ?? undefined,
        lastName: input.lastName?.trim() ?? undefined,
        email: input.email?.trim().toLowerCase() ?? undefined,
        phoneNumber: input.phoneNumber?.trim() ?? undefined,
        location: input.location?.trim() ?? undefined,
        title: input.title?.trim() ?? undefined,
        preferredLocale: input.preferredLocale?.trim() ?? undefined,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        location: true,
        title: true,
        preferredLocale: true,
      },
    })

    return { customer, mode: 'updated' as const }
  }

  async listAppointments(query: ListAiAppointmentsDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const search = query.search?.trim()

    const where: Prisma.CalendarEventWhereInput = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            startAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.calendarEvent.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          startAt: true,
          endAt: true,
          location: true,
          updatedAt: true,
        },
      }),
      this.prisma.calendarEvent.count({ where }),
    ])

    return { items, total, page, pageSize }
  }

  async createAppointment(input: CreateAiAppointmentDto) {
    const startAt = new Date(input.startAt)
    const endAt = input.endAt ? new Date(input.endAt) : null
    if (endAt && endAt < startAt) {
      throw new BadRequestException('appointment.endBeforeStart')
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type ?? EventType.MEETING,
        startAt,
        endAt,
        location: input.location?.trim() || null,
        metadata: {
          ...(input.metadata ?? {}),
          source: 'ai',
          customerId: input.customerId ?? null,
        },
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
      },
    })

    return {
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      type: event.type,
    }
  }

  async updateAppointment(id: number, input: UpdateAiAppointmentDto) {
    const existing = await this.prisma.calendarEvent.findUnique({
      where: { id },
      select: { id: true, startAt: true, endAt: true },
    })
    if (!existing) {
      throw new NotFoundException('appointment.notFound')
    }

    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt
    const endAt =
      input.endAt === undefined
        ? existing.endAt
        : input.endAt
          ? new Date(input.endAt)
          : null

    if (endAt && endAt < startAt) {
      throw new BadRequestException('appointment.endBeforeStart')
    }

    const event = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        title: input.title?.trim() ?? undefined,
        description: input.description?.trim() ?? undefined,
        startAt,
        endAt,
        type: input.type ?? undefined,
        location: input.location?.trim() ?? undefined,
      },
    })

    return {
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      type: event.type,
    }
  }

  async deleteAppointment(id: number) {
    const existing = await this.prisma.calendarEvent.findUnique({
      where: { id },
      select: { id: true, title: true },
    })
    if (!existing) {
      throw new NotFoundException('appointment.notFound')
    }

    await this.prisma.calendarEvent.delete({ where: { id } })
    return { id, deleted: true, title: existing.title }
  }

  async createProduct(input: CreateAiProductDto) {
    const product = await this.prisma.product.create({
      data: {
        name: input.name.trim(),
        productCode: input.productCode?.trim() || null,
        description: input.description?.trim() || null,
        categoryId: input.categoryId ?? null,
        productType: input.productType,
        mode: input.mode,
        salePrice: this.toDecimal(input.salePrice ?? 0),
        costPrice: this.toDecimal(input.costPrice ?? 0),
        currency: (input.currency?.trim() || 'UYU').toUpperCase(),
        unitOfMeasure: input.unitOfMeasure,
        stock: input.stock ?? 0,
        published: input.published ?? true,
      },
    })
    await this.m2DerivedProducts.invalidateBaseProduct(product.id)

    return {
      id: product.id,
      name: product.name,
      currency: product.currency,
      salePrice: Number(product.salePrice),
      mode: product.mode,
    }
  }

  async createCategory(input: CreateAiCategoryDto) {
    const normalizedName = input.name.trim()
    const existing = await this.prisma.productCategory.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
      },
    })

    if (existing) {
      return {
        category: existing,
        mode: 'existing' as const,
      }
    }

    const category = await this.prisma.productCategory.create({
      data: {
        name: normalizedName,
        description: input.description?.trim() || null,
        parentId: input.parentId ?? null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
      },
    })

    return {
      category,
      mode: 'created' as const,
    }
  }

  async updateCategory(id: number, input: UpdateAiCategoryDto) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new NotFoundException('category.notFound')
    }

    const category = await this.prisma.productCategory.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? undefined,
        description: input.description?.trim() ?? undefined,
        parentId: input.parentId ?? undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
      },
    })

    return {
      category,
      mode: 'updated' as const,
    }
  }

  async updateProduct(id: number, input: UpdateAiProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundException('product.notFound')
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? undefined,
        productCode: input.productCode?.trim() ?? undefined,
        description: input.description?.trim() ?? undefined,
        categoryId: input.categoryId ?? undefined,
        productType: input.productType ?? undefined,
        mode: input.mode ?? undefined,
        salePrice:
          input.salePrice !== undefined ? this.toDecimal(input.salePrice) : undefined,
        costPrice:
          input.costPrice !== undefined ? this.toDecimal(input.costPrice) : undefined,
        currency: input.currency?.trim().toUpperCase() ?? undefined,
        unitOfMeasure: input.unitOfMeasure ?? undefined,
        stock: input.stock ?? undefined,
        published: input.published ?? undefined,
      },
    })
    await this.m2DerivedProducts.invalidateBaseProduct(product.id)

    return {
      id: product.id,
      name: product.name,
      currency: product.currency,
      salePrice: Number(product.salePrice),
      mode: product.mode,
      published: product.published,
    }
  }

  async adjustProductStock(id: number, input: AdjustAiProductStockDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        stock: true,
      },
    })

    if (!existing) {
      throw new NotFoundException('product.notFound')
    }

    const hasDelta = Number.isInteger(input.delta)
    const hasStock = Number.isInteger(input.stock)
    if ((hasDelta && hasStock) || (!hasDelta && !hasStock)) {
      throw new BadRequestException('ai.productStock.adjust.invalidPayload')
    }

    const nextStock = hasStock ? Number(input.stock) : existing.stock + Number(input.delta)
    if (nextStock < 0) {
      throw new BadRequestException('ai.productStock.adjust.negativeStock')
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        stock: nextStock,
      },
      select: {
        id: true,
        name: true,
        stock: true,
      },
    })
    await this.m2DerivedProducts.invalidateBaseProduct(product.id)

    return {
      id: product.id,
      name: product.name,
      previousStock: existing.stock,
      stock: product.stock,
      deltaApplied: hasDelta ? Number(input.delta) : product.stock - existing.stock,
    }
  }

  async archiveProduct(id: number) {
    return this.setProductPublished(id, false)
  }

  async publishProduct(id: number) {
    return this.setProductPublished(id, true)
  }

  async createOrder(input: CreateAiOrderDto) {
    return this.createDocument(DocumentType.ORDER, input)
  }

  async generateQuote(input: GenerateAiQuoteDto) {
    return this.createDocument(DocumentType.BUDGET, input)
  }

  async createPayment(input: CreateAiPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, uuid: true },
    })
    if (!order) {
      throw new NotFoundException('order.notFound')
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: this.toDecimal(input.amount),
        currency: input.currency.trim().toUpperCase(),
        type: input.type ?? PaymentType.BALANCE,
        status: input.status ?? PaymentStatus.REGISTERED,
        method: input.method?.trim() || 'AI',
        reference: input.reference?.trim() || `ai:${randomUUID()}`,
        notes: input.notes?.trim() || null,
        metadata: {
          source: 'ai',
        },
      },
    })

    await this.prisma.orderTimelineEvent.create({
      data: {
        eventId: `ai-payment-${payment.id}-${randomUUID()}`,
        orderId: order.id,
        type: 'PAYMENT_REGISTERED',
        actor: 'ai',
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.method,
        message: `AI payment created for order ${order.uuid}`,
        metadata: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          source: 'ai',
        },
      },
    })

    return {
      id: payment.id,
      orderId: order.id,
      orderUuid: order.uuid,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
    }
  }

  async updateOrderStatus(id: number, input: UpdateAiDocumentStatusDto) {
    const matched = matchOrderStatus(input.status, DocumentType.ORDER)
    if (!matched) {
      throw new BadRequestException('ai.orderStatus.invalid')
    }

    await this.salesDocuments.updateDocumentStatus(DocumentType.ORDER, id, {
      status: matched.id,
      force: Boolean(input.force),
    })

    return {
      id,
      documentType: DocumentType.ORDER,
      status: this.serializeDocumentStatus(matched.id),
      updated: true,
    }
  }

  async updateOrderComment(id: number, input: UpdateAiDocumentCommentDto) {
    return this.updateDocumentComment(DocumentType.ORDER, id, input)
  }

  async updateQuoteStatus(id: number, input: UpdateAiDocumentStatusDto) {
    const matched = matchOrderStatus(input.status, DocumentType.BUDGET)
    if (!matched) {
      throw new BadRequestException('ai.quoteStatus.invalid')
    }

    await this.salesDocuments.updateDocumentStatus(DocumentType.BUDGET, id, {
      status: matched.id,
      force: Boolean(input.force),
    })

    return {
      id,
      documentType: DocumentType.BUDGET,
      status: this.serializeDocumentStatus(matched.id),
      updated: true,
    }
  }

  async updateQuoteComment(id: number, input: UpdateAiDocumentCommentDto) {
    return this.updateDocumentComment(DocumentType.BUDGET, id, input)
  }

  async sendQuote(id: number) {
    const result = await this.salesDocuments.sendBudget(id, null)
    return {
      id: result.budgetId,
      documentType: DocumentType.BUDGET,
      status: this.serializeDocumentStatus(result.statusId),
      validUntil: result.validUntilDate,
      updated: true,
    }
  }

  async confirmQuote(id: number) {
    const result = await this.salesDocuments.confirmBudget(id, null)
    return {
      id: result.budgetId,
      convertedOrderId: result.orderId,
      documentType: DocumentType.BUDGET,
      status: this.serializeDocumentStatus(1030),
      updated: true,
    }
  }

  async updatePaymentStatus(id: number, input: UpdateAiPaymentStatusDto) {
    const existing = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        orderId: true,
        order: {
          select: {
            uuid: true,
          },
        },
      },
    })

    if (!existing) {
      throw new NotFoundException('payment.notFound')
    }

    const status = input.status
    if (existing.status === status) {
      return {
        id: existing.id,
        orderId: existing.orderId,
        orderUuid: existing.order?.uuid ?? null,
        status,
        updated: false,
      }
    }

    const dispatchPlan = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: {
          status,
          updatedAt: new Date(),
        },
      })

      return this.paymentSettlement.apply(
        {
          paymentId: id,
          previousPaymentStatus: existing.status,
        },
        tx,
      )
    })

    await this.paymentSettlement.dispatch(dispatchPlan)

    return {
      id: existing.id,
      orderId: existing.orderId,
      orderUuid: existing.order?.uuid ?? null,
      status,
      updated: true,
    }
  }

  async updatePayment(id: number, input: UpdateAiPaymentDto) {
    const existing = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        order: {
          select: {
            uuid: true,
          },
        },
      },
    })

    if (!existing) {
      throw new NotFoundException('payment.notFound')
    }

    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        method: input.method?.trim() ?? undefined,
        reference: input.reference?.trim() ?? undefined,
        notes: input.notes?.trim() ?? undefined,
      },
      select: {
        id: true,
        orderId: true,
        method: true,
        reference: true,
        notes: true,
        order: {
          select: {
            uuid: true,
          },
        },
      },
    })

    return {
      id: payment.id,
      orderId: payment.orderId,
      orderUuid: payment.order?.uuid ?? null,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      updated: true,
    }
  }

  async updateOrderStructure(id: number, input: UpdateAiDocumentStructureDto) {
    return this.updateDocumentStructure(DocumentType.ORDER, id, input)
  }

  async updateQuoteStructure(id: number, input: UpdateAiDocumentStructureDto) {
    return this.updateDocumentStructure(DocumentType.BUDGET, id, input)
  }

  async parseAberturas(input: ParseAiAberturasDto) {
    const parsedContext = await this.aberturasParser.buildParsedContext(input)

    return {
      source: input.source?.trim() || 'chat',
      referenceDate: input.referenceDate?.trim() || null,
      config: parsedContext.config,
      itemCount: parsedContext.items.length,
      items: parsedContext.items,
      needsReview: parsedContext.items.some(
        (item) => item.missingFields.length > 0 || item.doubtfulFields.length > 0,
      ),
      summary: parsedContext.items.length
        ? parsedContext.items
            .map(
              (item) =>
                `${item.lineNumber}. ${item.familyId || item.familyLabel || 'sin familia'} ${item.serie || 'sin serie'} ${item.widthMm ?? '?'}x${item.heightMm ?? '?'}${item.price != null ? ` ${item.currency || ''} ${item.price}` : ''}`.trim(),
            )
            .join(' | ')
        : 'Sin items detectados',
    }
  }

  async prepareAberturasInsert(input: PrepareAiAberturasInsertDto) {
    const parsedContext = await this.aberturasParser.buildParsedContext(input)

    const items = parsedContext.items.map((item) => {
      const validForInsert =
        Boolean(item.familyId) &&
        Boolean(item.serie) &&
        Boolean(item.widthMm) &&
        Boolean(item.heightMm) &&
        item.price != null &&
        Boolean(item.currency) &&
        item.processingScore >= 3

      return {
        ...item,
        validForInsert,
        needsReview: !validForInsert,
        insertPayload: validForInsert
          ? {
              name: this.buildAberturasDraftName(item),
              description: item.detalleSnapshot,
              productCode: null,
              productType: 'PHYSICAL',
              mode: ProductMode.SIMPLE,
              salePrice: item.price,
              currency: item.currency,
              unitOfMeasure: 'UNIT',
              stock: 0,
              published: false,
              metadata: {
                source: input.source?.trim() || 'admin_internal_chat',
                familyId: item.familyId,
                familyLabel: item.familyLabel,
                serie: item.serie,
                material: item.material,
                color: item.color,
                vidrio: item.vidrio,
                widthMm: item.widthMm,
                heightMm: item.heightMm,
                hasMosquitero: item.hasMosquitero,
                hasShutterMonoblock: item.hasShutterMonoblock,
                shutterSystem: item.shutterSystem,
                extras: item.extras,
                detalleSnapshot: item.detalleSnapshot,
              },
            }
          : null,
      }
    })

    return {
      source: input.source?.trim() || 'chat',
      referenceDate: input.referenceDate?.trim() || null,
      itemCount: items.length,
      readyItemCount: items.filter((item) => item.validForInsert).length,
      needsReview: items.some((item) => !item.validForInsert),
      readyForInsert: items.length > 0 && items.every((item) => item.validForInsert),
      items,
      summary: items.length
        ? items
            .map((item) => {
              const base = `${item.lineNumber}. ${item.familyId || item.familyLabel || 'sin familia'} ${item.serie || 'sin serie'} ${item.widthMm ?? '?'}x${item.heightMm ?? '?'}`
              return item.validForInsert
                ? `${base} ${item.currency || ''} ${item.price}`.trim()
                : `${base} faltantes:${[
                    item.price == null ? 'price' : null,
                    !item.currency ? 'currency' : null,
                    !item.familyId ? 'family_id' : null,
                    !item.serie ? 'serie' : null,
                    !item.widthMm ? 'width_mm' : null,
                    !item.heightMm ? 'height_mm' : null,
                  ]
                    .filter(Boolean)
                    .join(',')}`
            })
            .join(' | ')
        : 'Sin items detectados',
    }
  }

  async prepareAberturasQuote(input: PrepareAiAberturasQuoteDto) {
    const parsedContext = await this.aberturasParser.buildParsedContext(input)

    const preparedItems = await Promise.all(
      parsedContext.items.map(async (item) => {
        const pricing = await this.resolveAberturasDraftPricing(item)
        const hasExactReadyDraft = Boolean(pricing?.draftItem && pricing.matchLevel === 'exact')
        return {
          ...item,
          matchLevel: pricing?.matchLevel ?? 'none',
          quoteAvailable: pricing?.quoteAvailable ?? false,
          needsReview:
            item.missingFields.length > 0 ||
            item.doubtfulFields.length > 0 ||
            !hasExactReadyDraft,
          readyForQuote: hasExactReadyDraft,
          pricing: pricing
            ? {
                price: pricing.price,
                currency: pricing.currency,
                detailSnapshot: pricing.detailSnapshot,
                specifications: pricing.specifications,
                source: pricing.source,
                referenceDate: pricing.referenceDate,
                similarityScore: pricing.similarityScore,
                exact: pricing.matchLevel === 'exact',
              }
            : null,
          draftItem: pricing?.draftItem ?? null,
          suggestedMatches: pricing?.suggestedMatches ?? [],
        }
      }),
    )

    return {
      source: input.source?.trim() || 'chat',
      referenceDate: input.referenceDate?.trim() || null,
      itemCount: preparedItems.length,
      readyItemCount: preparedItems.filter((item) => item.readyForQuote).length,
      needsReview: preparedItems.some((item) => item.needsReview),
      readyForQuote: preparedItems.length > 0 && preparedItems.every((item) => item.readyForQuote),
      items: preparedItems,
      summary: preparedItems.length
        ? preparedItems
            .map((item) => {
              const base = `${item.lineNumber}. ${item.familyId || item.familyLabel || 'sin familia'} ${item.serie || 'sin serie'} ${item.widthMm ?? '?'}x${item.heightMm ?? '?'}`
              if (item.draftItem?.price != null) {
                return `${base} ${item.draftItem.currency || ''} ${item.draftItem.price}`.trim()
              }
              if (Array.isArray(item.suggestedMatches) && item.suggestedMatches.length > 0) {
                return `${base} match:${item.suggestedMatches[0].matchLevel}`
              }
              return `${base} sin cotización lista`
            })
            .join(' | ')
        : 'Sin items detectados',
    }
  }

  private decorateActionCatalogEntry(entry: AiActionCatalogEntry): AiActionCatalogEntry {
    const toolName = entry.toolName ?? this.inferToolNameFromAction(entry.key)
    const allowedRoles = AI_CONVERSATION_ROLES.filter((role) =>
      toolName ? getAiRoleConfig(role).allowedTools.includes(toolName) : false,
    )

    const scope =
      allowedRoles.some((role) => role === 'customer_authenticated')
        ? 'customer_authenticated'
        : allowedRoles.some((role) => getAiRoleConfig(role).type === 'customer')
          ? 'customer_public'
          : 'admin_internal'

    return {
      ...entry,
      scope,
      allowedRoles,
      toolName: toolName ?? undefined,
    }
  }

  private inferToolNameFromAction(key: string) {
    switch (key) {
      case 'products.search':
        return 'search_products'
      case 'categories.search':
        return 'search_categories'
      case 'customers.search':
        return 'search_customers'
      case 'appointments.search':
        return 'search_appointments'
      case 'orders.search':
        return 'search_orders'
      case 'quotes.search':
        return 'search_quotes'
      case 'payments.search':
        return 'search_payments'
      default:
        return null
    }
  }

  private getRoleCatalog() {
    return listAiRoleConfigs().map((entry) => ({
      key: entry.key,
      type: entry.type,
      label: entry.label,
      memoryTurns: entry.memoryTurns,
      allowedTools: entry.allowedTools,
      forbiddenIntents: entry.forbiddenIntents,
      requiresConfirmation: entry.requiresConfirmation,
      tone: entry.tone,
      authRoles: entry.authRoles,
      legacyScopes: entry.legacyScopes,
    }))
  }

  async getRuntimeConfigSummary() {
    const stored = await this.secureConfig.getJson<StoredAiRuntimeConfig>(
      AiService.AI_RUNTIME_CONFIG_KEY,
    )
    const resolved = this.mergeRuntimeConfig(stored?.value)
    const usage = this.buildUsageSummary(resolved)

    return {
      enabled: resolved.enabled,
      provider: resolved.provider,
      model: resolved.model,
      hasOpenAiApiKey: Boolean(resolved.openAiApiKey),
      openAiApiKeyMasked: resolved.openAiApiKey ? 'configured' : '',
      monthlySpendingLimitUsd: resolved.monthlySpendingLimitUsd,
      currentUsageUsd: resolved.currentUsageUsd,
      warningThresholdPercent: resolved.warningThresholdPercent,
      usageMessage: resolved.usageMessage ?? null,
      adminInternalPrompt: resolved.adminInternalPrompt ?? null,
      customerPublicPrompt: resolved.customerPublicPrompt ?? null,
      customerGreetingDefault: resolved.customerGreetingDefault ?? null,
      customerGreetingMorning: resolved.customerGreetingMorning ?? null,
      customerGreetingAfternoon: resolved.customerGreetingAfternoon ?? null,
      customerGreetingConsultation: resolved.customerGreetingConsultation ?? null,
      customerGreetingHelp: resolved.customerGreetingHelp ?? null,
      adminGreetingDefault: resolved.adminGreetingDefault ?? null,
      customerGroundedRewriteEnabled:
        resolved.customerGroundedRewriteEnabled ?? false,
      customerGroundedRewriteMaxChars:
        resolved.customerGroundedRewriteMaxChars ?? 220,
      customerDecisionAssistEnabled:
        resolved.customerDecisionAssistEnabled ?? false,
      customerDecisionAssistMinConfidence:
        resolved.customerDecisionAssistMinConfidence ?? 0.82,
      customerCapabilityProfile:
        resolved.customerCapabilityProfile ?? 'full_assistant',
      customerContentMode: resolved.customerContentMode ?? 'enabled',
      customerCommerceMode: resolved.customerCommerceMode ?? 'enabled',
      customerSchedulingMode: resolved.customerSchedulingMode ?? 'enabled',
      customerWordingRegistry: resolved.customerWordingRegistry ?? null,
      customerWordingRegistryJson: resolved.customerWordingRegistry
        ? JSON.stringify(resolved.customerWordingRegistry, null, 2)
        : '',
      customerWordingOverrides: resolved.customerWordingOverrides ?? null,
      customerWordingOverridesJson: resolved.customerWordingOverrides
        ? JSON.stringify(resolved.customerWordingOverrides, null, 2)
        : '',
      customerHybridIntentRegistry: resolved.customerHybridIntentRegistry ?? null,
      customerHybridIntentRegistryJson: resolved.customerHybridIntentRegistry
        ? JSON.stringify({ rules: resolved.customerHybridIntentRegistry }, null, 2)
        : '',
      roleCatalog: this.getRoleCatalog(),
      usage,
      source: stored ? 'database' : 'environment',
      updatedAt: stored?.updatedAt ?? null,
    }
  }

  async getRuntimeConfigInternal() {
    const stored = await this.secureConfig.getJson<StoredAiRuntimeConfig>(
      AiService.AI_RUNTIME_CONFIG_KEY,
    )
    const resolved = this.mergeRuntimeConfig(stored?.value)
    const usage = this.buildUsageSummary(resolved)

    return {
      enabled: resolved.enabled,
      provider: resolved.provider,
      model: resolved.model,
      openAiApiKey: resolved.openAiApiKey ?? '',
      monthlySpendingLimitUsd: resolved.monthlySpendingLimitUsd,
      currentUsageUsd: resolved.currentUsageUsd,
      warningThresholdPercent: resolved.warningThresholdPercent,
      usageMessage: resolved.usageMessage ?? null,
      adminInternalPrompt: resolved.adminInternalPrompt ?? null,
      customerPublicPrompt: resolved.customerPublicPrompt ?? null,
      customerGreetingDefault: resolved.customerGreetingDefault ?? null,
      customerGreetingMorning: resolved.customerGreetingMorning ?? null,
      customerGreetingAfternoon: resolved.customerGreetingAfternoon ?? null,
      customerGreetingConsultation: resolved.customerGreetingConsultation ?? null,
      customerGreetingHelp: resolved.customerGreetingHelp ?? null,
      adminGreetingDefault: resolved.adminGreetingDefault ?? null,
      customerGroundedRewriteEnabled:
        resolved.customerGroundedRewriteEnabled ?? false,
      customerGroundedRewriteMaxChars:
        resolved.customerGroundedRewriteMaxChars ?? 220,
      customerDecisionAssistEnabled:
        resolved.customerDecisionAssistEnabled ?? false,
      customerDecisionAssistMinConfidence:
        resolved.customerDecisionAssistMinConfidence ?? 0.82,
      customerCapabilityProfile:
        resolved.customerCapabilityProfile ?? 'full_assistant',
      customerContentMode: resolved.customerContentMode ?? 'enabled',
      customerCommerceMode: resolved.customerCommerceMode ?? 'enabled',
      customerSchedulingMode: resolved.customerSchedulingMode ?? 'enabled',
      customerWordingRegistry: resolved.customerWordingRegistry ?? null,
      customerWordingRegistryJson: resolved.customerWordingRegistry
        ? JSON.stringify(resolved.customerWordingRegistry, null, 2)
        : '',
      customerWordingOverrides: resolved.customerWordingOverrides ?? null,
      customerWordingOverridesJson: resolved.customerWordingOverrides
        ? JSON.stringify(resolved.customerWordingOverrides, null, 2)
        : '',
      customerHybridIntentRegistry: resolved.customerHybridIntentRegistry ?? null,
      customerHybridIntentRegistryJson: resolved.customerHybridIntentRegistry
        ? JSON.stringify({ rules: resolved.customerHybridIntentRegistry }, null, 2)
        : '',
      roleCatalog: this.getRoleCatalog(),
      usage,
      updatedAt: stored?.updatedAt ?? null,
    }
  }

  async updateRuntimeConfig(input: UpdateAiRuntimeConfigDto) {
    const current = await this.secureConfig.getJson<StoredAiRuntimeConfig>(
      AiService.AI_RUNTIME_CONFIG_KEY,
    )
    const merged: StoredAiRuntimeConfig = {
      ...this.mergeRuntimeConfig(current?.value),
      ...Object.fromEntries(
        Object.entries({
          enabled: input.enabled,
          provider: input.provider,
          model: input.model?.trim() || undefined,
          monthlySpendingLimitUsd: input.monthlySpendingLimitUsd,
          currentUsageUsd: input.currentUsageUsd,
          warningThresholdPercent: input.warningThresholdPercent,
          usageMessage:
            input.usageMessage === undefined ? undefined : input.usageMessage?.trim() || null,
          adminInternalPrompt:
            input.adminInternalPrompt === undefined
              ? undefined
              : input.adminInternalPrompt?.trim() || null,
          customerPublicPrompt:
            input.customerPublicPrompt === undefined
              ? undefined
              : input.customerPublicPrompt?.trim() || null,
          customerGreetingDefault:
            input.customerGreetingDefault === undefined
              ? undefined
              : input.customerGreetingDefault?.trim() || null,
          customerGreetingMorning:
            input.customerGreetingMorning === undefined
              ? undefined
              : input.customerGreetingMorning?.trim() || null,
          customerGreetingAfternoon:
            input.customerGreetingAfternoon === undefined
              ? undefined
              : input.customerGreetingAfternoon?.trim() || null,
          customerGreetingConsultation:
            input.customerGreetingConsultation === undefined
              ? undefined
              : input.customerGreetingConsultation?.trim() || null,
          customerGreetingHelp:
            input.customerGreetingHelp === undefined
              ? undefined
              : input.customerGreetingHelp?.trim() || null,
          adminGreetingDefault:
            input.adminGreetingDefault === undefined
              ? undefined
              : input.adminGreetingDefault?.trim() || null,
          customerGroundedRewriteEnabled:
            input.customerGroundedRewriteEnabled,
          customerGroundedRewriteMaxChars:
            input.customerGroundedRewriteMaxChars,
          customerDecisionAssistEnabled:
            input.customerDecisionAssistEnabled,
          customerDecisionAssistMinConfidence:
            input.customerDecisionAssistMinConfidence,
          customerCapabilityProfile: input.customerCapabilityProfile,
          customerContentMode: input.customerContentMode,
          customerCommerceMode: input.customerCommerceMode,
          customerSchedulingMode: input.customerSchedulingMode,
          customerWordingRegistry:
            this.parseRuntimeWordingRegistryJson(
              input.customerWordingRegistryJson ?? input.customerWordingOverridesJson,
            ),
          customerWordingOverrides:
            this.parseRuntimeWordingRegistryJson(
              input.customerWordingRegistryJson ?? input.customerWordingOverridesJson,
            ),
          customerHybridIntentRegistry: this.parseRuntimeHybridIntentRegistryJson(
            input.customerHybridIntentRegistryJson,
          ),
        }).filter(([, value]) => value !== undefined),
      ),
    }

    if (input.openAiApiKey !== undefined) {
      merged.openAiApiKey = input.openAiApiKey.trim() || null
    }

    await this.secureConfig.setJson(AiService.AI_RUNTIME_CONFIG_KEY, merged)
    return this.getRuntimeConfigSummary()
  }

  private async setProductPublished(id: number, published: boolean) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new NotFoundException('product.notFound')
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { published },
    })
    await this.m2DerivedProducts.invalidateBaseProduct(product.id)

    return {
      id: product.id,
      archived: !published,
      published: product.published,
      name: product.name,
    }
  }

  private async updateDocumentComment(
    documentType: DocumentType,
    id: number,
    input: UpdateAiDocumentCommentDto,
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        uuid: true,
        documentType: true,
      },
    })

    if (!existing || existing.documentType !== documentType) {
      throw new NotFoundException(
        documentType === DocumentType.ORDER ? 'order.notFound' : 'quote.notFound',
      )
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        comment: input.comment?.trim() || null,
      },
      select: {
        id: true,
        uuid: true,
        documentType: true,
        comment: true,
      },
    })

    await this.prisma.orderTimelineEvent.create({
      data: {
        eventId: `ai-comment-${documentType.toLowerCase()}-${order.id}-${randomUUID()}`,
        orderId: order.id,
        type: 'COMMENT_ADDED',
        actor: 'ai',
        message: `${documentType === DocumentType.ORDER ? 'Order' : 'Quote'} comment updated by AI`,
        metadata: {
          source: 'ai',
          documentType,
          comment: order.comment,
        },
      },
    })

    return {
      id: order.id,
      uuid: order.uuid,
      documentType: order.documentType,
      comment: order.comment,
      updated: true,
    }
  }

  private async createDocument(
    documentType: DocumentType,
    input: CreateAiOrderDto | GenerateAiQuoteDto,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        name: true,
      },
    })
    if (!customer) {
      throw new NotFoundException('customer.notFound')
    }
    if (!input.items.length) {
      throw new BadRequestException('order.itemsRequired')
    }

    const currency = (input.currency?.trim() || 'UYU').toUpperCase()
    const deliveryFees = this.toDecimal(input.deliveryFees ?? 0)
    const subTotal = input.items.reduce(
      (acc, item) => acc.plus(this.toDecimal(item.price).mul(item.qty)),
      new Prisma.Decimal(0),
    )
    const grandTotal = subTotal.plus(deliveryFees)
    const validUntil =
      documentType === DocumentType.BUDGET && 'validForDays' in input
        ? new Date(Date.now() + ((input.validForDays ?? 7) * 24 * 60 * 60 * 1000))
        : null

    const document = await this.prisma.order.create({
      data: {
        documentType,
        customerId: customer.id,
        comment: input.comment?.trim() || null,
        orderCurrency: currency,
        shippingAddress1: input.shippingAddress1?.trim() || null,
        shippingAddress2: input.shippingAddress2?.trim() || null,
        shippingCity: input.shippingCity?.trim() || null,
        shippingDepartment: input.shippingDepartment?.trim() || null,
        shippingNeighborhood: input.shippingNeighborhood?.trim() || null,
        shippingZip: input.shippingZip?.trim() || null,
        shippingCountry: input.shippingCountry?.trim() || null,
        deliveryFees,
        subTotal,
        grandTotal,
        validUntil,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId ?? null,
            name: item.name.trim(),
            price: this.toDecimal(item.price),
            qty: item.qty,
            description: item.description?.trim() || null,
            comments: item.comments?.trim() || null,
            unitAmount: this.toDecimal(item.price),
            unitCurrency: currency,
            unitAmountOrderCurrency: this.toDecimal(item.price),
            nameSnapshot: item.name.trim(),
          })),
        },
      },
    })

    await this.prisma.orderTimelineEvent.create({
      data: {
        eventId: `ai-${documentType.toLowerCase()}-${document.id}-${randomUUID()}`,
        orderId: document.id,
        type: documentType === DocumentType.ORDER ? 'ORDER_CREATED' : 'BUDGET_CREATED',
        actor: 'ai',
        amount: grandTotal,
        currency,
        message: `${documentType === DocumentType.ORDER ? 'Order' : 'Quote'} created by AI`,
        metadata: {
          source: 'ai',
          customerName: customer.name,
        },
      },
    })

    return {
      id: document.id,
      uuid: document.uuid,
      documentType: document.documentType,
      customerId: customer.id,
      customerName: customer.name,
      currency,
      subTotal: Number(subTotal),
      deliveryFees: Number(deliveryFees),
      grandTotal: Number(grandTotal),
      validUntil,
    }
  }

  private async updateDocumentStructure(
    documentType: DocumentType,
    id: number,
    input: UpdateAiDocumentStructureDto,
  ) {
    const details = await this.salesDocuments.getDocumentDetails(documentType, id)
    if (!details) {
      throw new NotFoundException(
        documentType === DocumentType.ORDER ? 'order.notFound' : 'quote.notFound',
      )
    }

    const nextItems = this.mergeDocumentItems(details.items ?? [], input)
    if (!nextItems.length) {
      throw new BadRequestException(
        documentType === DocumentType.ORDER ? 'order.itemsRequired' : 'quote.itemsRequired',
      )
    }

    const baseDto = this.mapDocumentDetailsToReplaceDto(details)
    baseDto.items = nextItems

    if (input.currency?.trim()) {
      baseDto.orderCurrency = input.currency.trim().toUpperCase()
    }

    if (input.comment !== undefined) {
      baseDto.comment = input.comment?.trim() || undefined
    }

    baseDto.shipping = {
      ...baseDto.shipping,
      shippingVendor:
        input.shippingVendor !== undefined
          ? input.shippingVendor?.trim() || undefined
          : baseDto.shipping?.shippingVendor,
      deliveryFees: input.deliveryFees ?? baseDto.shipping?.deliveryFees,
      estimatedMin: input.estimatedMin ?? baseDto.shipping?.estimatedMin,
      estimatedMax: input.estimatedMax ?? baseDto.shipping?.estimatedMax,
    }

    baseDto.shippingAddress = {
      ...baseDto.shippingAddress,
      addressLine1:
        input.shippingAddress1 !== undefined
          ? input.shippingAddress1?.trim() || ''
          : baseDto.shippingAddress.addressLine1,
      addressLine2:
        input.shippingAddress2 !== undefined
          ? input.shippingAddress2?.trim() || undefined
          : baseDto.shippingAddress.addressLine2,
      city:
        input.shippingCity !== undefined
          ? input.shippingCity?.trim() || ''
          : baseDto.shippingAddress.city,
      state:
        input.shippingDepartment !== undefined
          ? input.shippingDepartment?.trim() || undefined
          : baseDto.shippingAddress.state,
      neighborhood:
        input.shippingNeighborhood !== undefined
          ? input.shippingNeighborhood?.trim() || undefined
          : baseDto.shippingAddress.neighborhood,
      country:
        input.shippingCountry !== undefined
          ? input.shippingCountry?.trim() || undefined
          : baseDto.shippingAddress.country,
    }

    if (input.shippingZip !== undefined) {
      ;(baseDto.shippingAddress as Record<string, unknown>).zip =
        input.shippingZip?.trim() || undefined
    }

    if (documentType === DocumentType.BUDGET) {
      if (input.validUntilDate) {
        baseDto.validUntilDate = input.validUntilDate
        baseDto.validUntil = input.validUntilDate
      } else if (typeof input.validForDays === 'number' && input.validForDays > 0) {
        const nextValidUntil = new Date(
          Date.now() + input.validForDays * 24 * 60 * 60 * 1000,
        ).toISOString()
        baseDto.validUntilDate = nextValidUntil
        baseDto.validUntil = nextValidUntil
      }
    }

    const replaced = await this.salesDocuments.replaceDocument(documentType, id, baseDto)
    const refreshed = await this.salesDocuments.getDocumentDetails(documentType, id)

    return {
      id,
      uuid: refreshed?.uuid ?? details.uuid ?? null,
      documentType,
      updated: true,
      currency: refreshed?.orderCurrency ?? baseDto.orderCurrency ?? null,
      validUntilDate: refreshed?.validUntilDate ?? null,
      deliveryFees: refreshed?.deliveryFees ?? baseDto.shipping?.deliveryFees ?? null,
      shippingVendor: refreshed?.shippingVendor ?? baseDto.shipping?.shippingVendor ?? null,
      itemCount: Array.isArray(refreshed?.items) ? refreshed.items.length : nextItems.length,
      result: replaced,
    }
  }

  private mapDocumentDetailsToReplaceDto(details: Record<string, any>): CreateOrderDto {
    const shippingState = details.shippingState ?? details.shippingDepartment ?? 'Montevideo'
    const shippingCountry = details.shippingCountry ?? shippingState ?? 'Uruguay'
    const billingState = details.billingState ?? shippingState
    const billingCountry = details.billingCountry ?? shippingCountry
    const paymentMethodName =
      details.paymentMethod?.name ?? details.paymentMethod?.label ?? 'Contado'

    return {
      customerId: String(details.customer?.id ?? ''),
      date:
        details.date instanceof Date
          ? details.date.toISOString()
          : typeof details.date === 'string'
            ? details.date
            : new Date().toISOString(),
      paymentMehod: paymentMethodName,
      orderCurrency: details.orderCurrency ?? 'UYU',
      validUntilDate: details.validUntilDate ?? undefined,
      validUntil: details.validUntilDate ?? undefined,
      items: (details.items ?? []).map((item: Record<string, any>) =>
        this.mapExistingDocumentItemToReplaceItem(item, details.orderCurrency ?? 'UYU'),
      ),
      shippingAddress: {
        addressLine1: details.shippingAddress1 ?? '',
        addressLine2: details.shippingAddress2 ?? undefined,
        city: details.shippingCity ?? '',
        state: shippingState,
        neighborhood: details.shippingNeighborhood ?? undefined,
        country: shippingCountry,
      },
      billingAddress: {
        addressLine1: details.billingAddress1 ?? details.shippingAddress1 ?? '',
        addressLine2: details.billingAddress2 ?? details.shippingAddress2 ?? undefined,
        city: details.billingCity ?? details.shippingCity ?? '',
        state: billingState,
        neighborhood: details.billingNeighborhood ?? details.shippingNeighborhood ?? undefined,
        country: billingCountry,
      },
      billingSameAsShipping: Boolean(details.billingSameAsShipping),
      shipping: {
        shippingVendor: details.shippingVendor ?? undefined,
        deliveryFees:
          typeof details.deliveryFees === 'number' ? details.deliveryFees : 0,
        estimatedMin:
          typeof details.estimatedMin === 'number' ? details.estimatedMin : undefined,
        estimatedMax:
          typeof details.estimatedMax === 'number' ? details.estimatedMax : undefined,
      },
      comment: details.comment ?? undefined,
      disclaimer: details.disclaimer ?? undefined,
      minimumDepositType: details.minimumDepositType ?? undefined,
      minimumDepositValue:
        typeof details.minimumDepositValue === 'number'
          ? details.minimumDepositValue
          : undefined,
      activityId:
        details.activityId !== null && details.activityId !== undefined
          ? String(details.activityId)
          : undefined,
    }
  }

  private mapExistingDocumentItemToReplaceItem(
    item: Record<string, any>,
    defaultCurrency: string,
  ) {
    const productIdRaw =
      item.productId !== null && item.productId !== undefined
        ? String(item.productId)
        : `manual-${item.id ?? randomUUID()}`

    const price =
      typeof item.unitAmountOrderCurrency === 'number'
        ? item.unitAmountOrderCurrency
        : typeof item.price === 'number'
          ? item.price
          : 0

    return {
      productId: productIdRaw,
      name: String(item.name ?? '').trim(),
      price,
      qty: Number(item.qty ?? 1) || 1,
      description: item.description ?? undefined,
      comments: item.comments ?? undefined,
      specifications: item.specifications ?? undefined,
      currency: item.unitCurrency ?? defaultCurrency,
      unitPrice:
        typeof item.unitAmount === 'number' ? item.unitAmount : undefined,
      unitCurrency: item.unitCurrency ?? defaultCurrency,
      customAttributes:
        item.customAttributes && typeof item.customAttributes === 'object'
          ? item.customAttributes
          : undefined,
      pricingMethod: item.pricingMethod ?? undefined,
    }
  }

  private mergeDocumentItems(
    existingItems: Array<Record<string, any>>,
    input: UpdateAiDocumentStructureDto,
  ) {
    const defaultCurrency = 'UYU'
    let items = (existingItems ?? []).map((item) =>
      this.mapExistingDocumentItemToReplaceItem(item, item.unitCurrency ?? defaultCurrency),
    )

    if (Array.isArray(input.items)) {
      items = input.items.map((item, index) =>
        this.mapIncomingDocumentItem(item, `replacement-${index + 1}`),
      )
    }

    if (Array.isArray(input.removeItemNames) && input.removeItemNames.length > 0) {
      const toRemove = new Set(
        input.removeItemNames.map((name) => normalizeAberturasToken(name)),
      )
      items = items.filter(
        (item) => !toRemove.has(normalizeAberturasToken(item.name)),
      )
    }

    if (Array.isArray(input.appendItems) && input.appendItems.length > 0) {
      items.push(
        ...input.appendItems.map((item, index) =>
          this.mapIncomingDocumentItem(item, `append-${index + 1}`),
        ),
      )
    }

    return items
  }

  private mapIncomingDocumentItem(
    item: Record<string, any>,
    fallbackId: string,
  ) {
    return {
      productId:
        item.productId !== null && item.productId !== undefined
          ? String(item.productId)
          : fallbackId,
      name: String(item.name ?? '').trim(),
      price: Number(item.price ?? 0),
      qty: Math.max(1, Number(item.qty ?? 1) || 1),
      description: item.description?.trim() || undefined,
      comments: item.comments?.trim() || undefined,
      specifications: item.specifications?.trim() || undefined,
      currency: item.currency?.trim()?.toUpperCase() || undefined,
      unitPrice:
        item.unitPrice !== undefined && item.unitPrice !== null
          ? Number(item.unitPrice)
          : undefined,
      unitCurrency: item.unitCurrency?.trim()?.toUpperCase() || undefined,
      customAttributes:
        item.customAttributes && typeof item.customAttributes === 'object'
          ? item.customAttributes
          : undefined,
      pricingMethod: item.pricingMethod?.trim() || undefined,
    }
  }

  private async resolveAberturasDraftPricing(item: Record<string, any>) {
    if (
      !item.familyId ||
      !item.serie ||
      !item.color ||
      !item.vidrio ||
      !item.widthMm ||
      !item.heightMm
    ) {
      return null
    }

    const searchResult = await this.parametricPricing.searchMatrixDefault({
      familyId: item.familyId,
      serie: item.serie,
      color: item.color,
      vidrio: item.vidrio,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      hasMosquitero: Boolean(item.hasMosquitero),
      hasShutterMonoblock: Boolean(item.hasShutterMonoblock),
      shutterMaterial: item.shutterSystem || undefined,
      limit: 3,
    })

    const selectedMatch = searchResult.exact ?? searchResult.nearest?.[0] ?? null
    if (!selectedMatch || !selectedMatch.resolution?.available) {
      return {
        quoteAvailable: false,
        matchLevel: selectedMatch?.matchLevel ?? 'none',
        price: null,
        currency: null,
        detailSnapshot: null,
        specifications: null,
        source: null,
        referenceDate: null,
        similarityScore: selectedMatch?.metadata?.similarityScore ?? null,
        draftItem: null,
        suggestedMatches: [
          ...(searchResult.exact ? [searchResult.exact] : []),
          ...(searchResult.nearest ?? []),
        ].slice(0, 3).map((match) => this.mapAberturasMatchPreview(match)),
      }
    }

    const draftItem = {
      productId: undefined,
      name: this.buildAberturasDraftName(item),
      qty: 1,
      price: selectedMatch.resolution.price,
      currency: selectedMatch.resolution.currency,
      description: selectedMatch.row.detailSnapshot ?? item.detalleSnapshot ?? null,
      comments: this.buildAberturasDraftComments(item, selectedMatch),
    }

    return {
      quoteAvailable: true,
      matchLevel: selectedMatch.matchLevel,
      price: selectedMatch.resolution.price,
      currency: selectedMatch.resolution.currency,
      detailSnapshot: selectedMatch.row.detailSnapshot ?? null,
      specifications: selectedMatch.row.specifications ?? null,
      source: selectedMatch.row.source ?? null,
      referenceDate: selectedMatch.row.referenceDate ?? null,
      similarityScore: selectedMatch.metadata?.similarityScore ?? null,
      draftItem,
      suggestedMatches: [
        ...(searchResult.exact ? [searchResult.exact] : []),
        ...(searchResult.nearest ?? []),
      ]
        .slice(0, 3)
        .map((match) => this.mapAberturasMatchPreview(match)),
    }
  }

  private buildAberturasDraftName(item: Record<string, any>) {
    return [
      item.familyLabel || item.familyId || 'Abertura',
      item.serie || null,
      item.color || null,
      item.vidrio || null,
      item.widthMm && item.heightMm ? `${item.widthMm}x${item.heightMm}` : null,
    ]
      .filter(Boolean)
      .join(' ')
  }

  private buildAberturasDraftComments(item: Record<string, any>, match: Record<string, any>) {
    const notes = [
      item.detalleSnapshot ? `Origen: ${item.detalleSnapshot}` : null,
      Array.isArray(item.extras) && item.extras.length
        ? `Extras: ${item.extras.join(', ')}`
        : null,
      match.matchLevel !== 'exact' ? `Match ${match.matchLevel}` : null,
    ].filter(Boolean)
    return notes.length ? notes.join(' | ') : undefined
  }

  private mapAberturasMatchPreview(match: Record<string, any>) {
    return {
      matchLevel: match.matchLevel,
      similarityScore: match.metadata?.similarityScore ?? null,
      familyId: match.row?.familyId ?? null,
      serie: match.row?.serie ?? null,
      color: match.row?.color ?? null,
      vidrio: match.row?.vidrio ?? null,
      widthMm: match.row?.widthMm ?? null,
      heightMm: match.row?.heightMm ?? null,
      price: match.resolution?.available ? match.resolution.price : null,
      currency: match.resolution?.available ? match.resolution.currency : null,
      detailSnapshot: match.row?.detailSnapshot ?? null,
    }
  }

  private toDecimal(value: number | string) {
    return new Prisma.Decimal(value)
  }

  private decimalToNumber(value: { toNumber?: () => number } | number | string | null | undefined) {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
      return value.toNumber()
    }
    const normalized = Number(value)
    return Number.isFinite(normalized) ? normalized : null
  }

  private serializeDocumentStatus(statusId?: number | null) {
    const definition = findOrderStatusById(statusId ?? null)
    if (!definition) {
      return null
    }

    return {
      id: definition.id,
      code: definition.code,
      label: definition.label,
      color: definition.color,
    }
  }

  private mergeRuntimeConfig(
    stored?: Partial<StoredAiRuntimeConfig> | null,
  ): StoredAiRuntimeConfig {
    const enabledFromEnv = (this.config.get<string>('AI_ENABLED') ?? 'true') === 'true'
    const limitFromEnv = this.readNumberFromEnv('AI_MONTHLY_SPENDING_LIMIT_USD')
    const usageFromEnv = this.readNumberFromEnv('AI_CURRENT_USAGE_USD')
    const warningFromEnv =
      this.readNumberFromEnv('AI_WARNING_THRESHOLD_PERCENT') ?? 80

    return {
      enabled: stored?.enabled ?? enabledFromEnv,
      provider: stored?.provider ?? ((this.config.get<string>('AI_MODEL_PROVIDER') as StoredAiRuntimeConfig['provider']) || 'openai'),
      model: stored?.model ?? this.config.get<string>('AI_MODEL_NAME') ?? 'gpt-4o-mini',
      openAiApiKey:
        stored?.openAiApiKey !== undefined
          ? stored.openAiApiKey
          : this.config.get<string>('OPENAI_API_KEY') ?? '',
      monthlySpendingLimitUsd:
        stored?.monthlySpendingLimitUsd ?? limitFromEnv ?? 25,
      currentUsageUsd:
        stored?.currentUsageUsd ?? usageFromEnv ?? 0,
      warningThresholdPercent:
        stored?.warningThresholdPercent ?? warningFromEnv,
      usageMessage:
        stored?.usageMessage ?? 'Monitor usage closely before enabling high-volume channels.',
      adminInternalPrompt:
        stored?.adminInternalPrompt ??
        this.config.get<string>('AI_ADMIN_INTERNAL_PROMPT') ??
        null,
      customerPublicPrompt:
        stored?.customerPublicPrompt ??
        this.config.get<string>('AI_CUSTOMER_PUBLIC_PROMPT') ??
        null,
      customerGreetingDefault:
        stored?.customerGreetingDefault ??
        this.config.get<string>('AI_CUSTOMER_GREETING_DEFAULT') ??
        'Hola. ¿En qué podemos ayudarte hoy?',
      customerGreetingMorning:
        stored?.customerGreetingMorning ??
        this.config.get<string>('AI_CUSTOMER_GREETING_MORNING') ??
        'Buenos días. ¿En qué podemos ayudarte?',
      customerGreetingAfternoon:
        stored?.customerGreetingAfternoon ??
        this.config.get<string>('AI_CUSTOMER_GREETING_AFTERNOON') ??
        'Buenas tardes. ¿En qué podemos ayudarte hoy?',
      customerGreetingConsultation:
        stored?.customerGreetingConsultation ??
        this.config.get<string>('AI_CUSTOMER_GREETING_CONSULTATION') ??
        'Hola. Claro, cuéntanos tu consulta.',
      customerGreetingHelp:
        stored?.customerGreetingHelp ??
        this.config.get<string>('AI_CUSTOMER_GREETING_HELP') ??
        'Hola. Claro, ¿con qué te ayudamos?',
      adminGreetingDefault:
        stored?.adminGreetingDefault ??
        this.config.get<string>('AI_ADMIN_GREETING_DEFAULT') ??
        'Hola. ¿En qué te ayudo hoy?',
      customerGroundedRewriteEnabled:
        stored?.customerGroundedRewriteEnabled ??
        ((this.config.get<string>('AI_CUSTOMER_GROUNDED_REWRITE_ENABLED') ??
          'false') === 'true'),
      customerGroundedRewriteMaxChars:
        stored?.customerGroundedRewriteMaxChars ??
        this.readNumberFromEnv('AI_CUSTOMER_GROUNDED_REWRITE_MAX_CHARS') ??
        220,
      customerDecisionAssistEnabled:
        stored?.customerDecisionAssistEnabled ??
        ((this.config.get<string>('AI_CUSTOMER_DECISION_ASSIST_ENABLED') ?? 'false') ===
          'true'),
      customerDecisionAssistMinConfidence:
        stored?.customerDecisionAssistMinConfidence ??
        this.readNumberFromEnv('AI_CUSTOMER_DECISION_ASSIST_MIN_CONFIDENCE') ??
        0.82,
      customerCapabilityProfile:
        stored?.customerCapabilityProfile ?? 'full_assistant',
      customerContentMode: stored?.customerContentMode ?? 'enabled',
      customerCommerceMode: stored?.customerCommerceMode ?? 'enabled',
      customerSchedulingMode: stored?.customerSchedulingMode ?? 'enabled',
      customerWordingRegistry:
        this.normalizeRuntimeWordingRegistry(
          stored?.customerWordingRegistry ?? stored?.customerWordingOverrides,
        ) ?? null,
      customerWordingOverrides:
        this.normalizeRuntimeWordingRegistry(
          stored?.customerWordingRegistry ?? stored?.customerWordingOverrides,
        ) ?? null,
      customerHybridIntentRegistry:
        this.normalizeRuntimeHybridIntentRegistry(stored?.customerHybridIntentRegistry) ?? null,
    }
  }

  private buildUsageSummary(config: StoredAiRuntimeConfig) {
    const limit = config.monthlySpendingLimitUsd ?? null
    const usage = config.currentUsageUsd ?? 0
    if (!limit || limit <= 0) {
      return {
        status: 'unbounded' as const,
        ratio: null,
        nearLimit: false,
        exceeded: false,
        message: 'No spending limit configured yet.',
      }
    }

    const ratio = usage / limit
    const threshold = (config.warningThresholdPercent ?? 80) / 100
    const exceeded = ratio >= 1
    const nearLimit = !exceeded && ratio >= threshold

    return {
      status: exceeded ? 'exceeded' : nearLimit ? 'near_limit' : 'healthy',
      ratio,
      nearLimit,
      exceeded,
      message: exceeded
        ? 'Current usage exceeded the configured spending limit.'
        : nearLimit
          ? 'Current usage is approaching the configured spending limit.'
          : 'Current usage remains within the configured operating range.',
    }
  }

  private readNumberFromEnv(key: string) {
    const raw = this.config.get<string>(key)
    if (raw === undefined || raw === null || raw === '') {
      return null
    }
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }
}
