import { EmailCategory, Role } from '@prisma/client'
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum } from 'class-validator'

export class UpsertRoleRuleDto {
  @IsEnum(Role)
  role!: Role

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(EmailCategory, { each: true })
  categories!: EmailCategory[]

  @IsBoolean()
  enabled!: boolean
}
