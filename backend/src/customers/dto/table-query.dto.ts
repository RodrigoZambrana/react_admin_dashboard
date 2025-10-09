import { IsIn, IsNumber, IsOptional, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { IsSafeString } from '../../common/validation/is-safe-string.decorator'

class TableSortDto {
  @IsOptional()
  @IsSafeString()
  key?: string

  @IsOptional()
  @IsIn(['asc', 'desc', ''])
  order?: 'asc' | 'desc' | ''
}

class TableFilterDto {
  @IsOptional()
  @IsSafeString()
  statusId?: string | null
}

export class TableQueryDto {
  @IsNumber()
  pageIndex!: number

  @IsNumber()
  pageSize!: number

  @IsOptional()
  @IsSafeString()
  query?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => TableSortDto)
  sort?: TableSortDto

  @IsOptional()
  @ValidateNested()
  @Type(() => TableFilterDto)
  filterData?: TableFilterDto
}
