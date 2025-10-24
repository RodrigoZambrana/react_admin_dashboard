import { IsOptional, IsString } from 'class-validator'

export class MoveMessageDto {
  @IsOptional()
  @IsString()
  threadRemoteId?: string

  @IsString()
  targetMailbox!: string
}
