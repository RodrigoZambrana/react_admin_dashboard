import { PaymentStatus } from '@prisma/client'
import { IsEnum } from 'class-validator'

export class UpdateAiPaymentStatusDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus
}
