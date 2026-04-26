import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminConversationMuteDto {
  @IsIn(['off', '8h', '7d'])
  preset!: 'off' | '8h' | '7d';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorKey?: string;
}
