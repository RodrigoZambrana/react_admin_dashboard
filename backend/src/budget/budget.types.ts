import { IsArray, IsEmail, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export type BudgetMeasurementType = 'M2'

export type BudgetCalculationResult = {
  productId: number
  width: number
  height: number
  area: number
  unitPrice: number
  totalPrice: number
  currency?: string
  measurementType: BudgetMeasurementType
  strategy: string
}

export type BudgetProductResult = {
  id: number
  slug: string
  name: string
  productCode: string | null
  img: string | null
  description: string | null
  currency: string
  unitPrice: number
  measurementType: BudgetMeasurementType
  isPublic: boolean
  isBudgetCalculable: boolean
  calculationStrategy: string
}

export type BudgetAddToCartResult = {
  currency: string
  subtotal: number
  items: Array<
    BudgetCalculationResult & {
      qty: number
      product: BudgetProductResult
    }
  >
}

export type BudgetSummaryItemResult = BudgetCalculationResult & {
  qty: number
  lineTotal: number
  product: BudgetProductResult
}

export type BudgetSummaryResult = {
  currency: string
  subtotal: number
  shippingFee: number
  grandTotal: number
  items: BudgetSummaryItemResult[]
  customer: {
    name: string | null
    email: string | null
    phone: string | null
    notes: string | null
  }
}

export type BudgetLeadResult = {
  customerId: number
  name: string
  email: string | null
  phone: string | null
  status: string | null
}

export class BudgetCalculateDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId!: number

  @IsNumber()
  @Min(0.0000001)
  @Type(() => Number)
  width!: number

  @IsNumber()
  @Min(0.0000001)
  @Type(() => Number)
  height!: number

  @IsOptional()
  @IsString()
  currency?: string
}

export class BudgetAddToCartItemDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId!: number

  @IsNumber()
  @Min(0.0000001)
  @Type(() => Number)
  width!: number

  @IsNumber()
  @Min(0.0000001)
  @Type(() => Number)
  height!: number

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  qty?: number
}

export class BudgetAddToCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetAddToCartItemDto)
  items!: BudgetAddToCartItemDto[]

  @IsOptional()
  @IsString()
  customerName?: string

  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @IsOptional()
  @IsString()
  customerPhone?: string

  @IsOptional()
  @IsString()
  customerNotes?: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string

  @IsOptional()
  @IsString()
  currency?: string
}

export class BudgetSummaryDto extends BudgetAddToCartDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  shippingFee?: number
}

export class BudgetLeadDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}
