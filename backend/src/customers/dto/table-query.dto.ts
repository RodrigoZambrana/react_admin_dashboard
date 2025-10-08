import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator'

export class TableQueryDto {
  @IsNumber()
  pageIndex!: number

  @IsNumber()
  pageSize!: number

  @IsOptional()
  @IsString()
  query?: string

  @IsOptional()
  @IsObject()
  sort?: { key?: string; order?: 'asc' | 'desc' | '' }

  @IsOptional()
  @IsObject()
  filterData?: { statusId?: number | string | null }
}
