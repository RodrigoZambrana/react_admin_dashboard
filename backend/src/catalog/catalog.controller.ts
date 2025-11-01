import { Controller, Get, Headers, Query } from '@nestjs/common'
import { DocumentType } from '@prisma/client'
import { listPaymentMethods } from '../common/constants/payment-methods'
import { listOrderStatuses } from '../common/constants/order-statuses'

const parseDocumentType = (value?: string | null): DocumentType | null => {
  if (!value) {
    return null
  }
  const normalized = value.trim().toUpperCase()
  if (!normalized) {
    return null
  }
  if (normalized === 'ORDER' || normalized === 'ORDERS') {
    return DocumentType.ORDER
  }
  if (normalized === 'BUDGET' || normalized === 'BUDGETS' || normalized === 'QUOTE' || normalized === 'QUOTES') {
    return DocumentType.BUDGET
  }
  return null
}

@Controller()
export class CatalogController {
  @Get('payment-methods')
  getPaymentMethods(@Headers('accept-language') acceptLanguage?: string) {
    return listPaymentMethods(acceptLanguage)
  }

  @Get('order-statuses')
  getOrderStatuses(
    @Query('documentType') documentType?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const normalizedDocumentType = parseDocumentType(documentType)
    return listOrderStatuses(normalizedDocumentType, acceptLanguage)
  }
}

