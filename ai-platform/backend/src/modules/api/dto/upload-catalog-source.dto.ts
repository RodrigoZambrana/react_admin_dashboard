import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UploadCatalogSourceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
