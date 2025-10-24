import { IsOptional, IsString } from 'class-validator'

export class GetMessageQueryDto {
  @IsOptional()
  @IsString()
  threadRemoteId?: string
}
