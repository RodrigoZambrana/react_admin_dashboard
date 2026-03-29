import { IsOptional, IsString } from 'class-validator'

export class MoveMessageDto {
  @IsOptional()
  @IsString()
  threadRemoteId?: string

  @IsOptional()
  @IsString()
  mailbox?: string

  @IsString()
  targetMailbox!: string
}
