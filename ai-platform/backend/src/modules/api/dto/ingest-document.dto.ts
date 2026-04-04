import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class IngestDocumentDto {
  @IsOptional()
  @IsBoolean()
  activate?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
