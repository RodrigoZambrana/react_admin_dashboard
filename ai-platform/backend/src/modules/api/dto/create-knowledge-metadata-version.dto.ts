import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateKnowledgeMetadataVersionDto {
  @IsString()
  key!: string;

  @IsObject()
  resource!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
