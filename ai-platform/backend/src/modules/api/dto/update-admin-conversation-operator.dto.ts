import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminConversationOperatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorKey?: string;
}
