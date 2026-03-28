import { DocumentType } from '@prisma/client'
import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsString, Min } from 'class-validator'

export class GetOwnedCustomerDocumentDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  customerId!: number

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  identifier!: string

  @IsEnum(DocumentType)
  documentType!: DocumentType
}
