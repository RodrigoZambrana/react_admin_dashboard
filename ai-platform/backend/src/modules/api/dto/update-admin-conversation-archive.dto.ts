import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminConversationArchiveDto {
  @IsBoolean()
  archived!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorKey?: string;
}
