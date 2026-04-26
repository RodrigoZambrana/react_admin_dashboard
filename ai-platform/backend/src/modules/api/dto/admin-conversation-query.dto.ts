import { IsBooleanString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminConversationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorKey?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsBooleanString()
  includeArchived?: string;

  @IsOptional()
  @IsBooleanString()
  includeDeleted?: string;
}
