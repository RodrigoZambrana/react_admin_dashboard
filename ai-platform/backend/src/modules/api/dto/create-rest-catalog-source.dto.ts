import { IsBoolean, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateRestCatalogSourceDto {
  @IsString()
  title!: string;

  @IsUrl()
  endpointUrl!: string;

  @IsOptional()
  @IsString()
  queryParam?: string;

  @IsOptional()
  @IsString()
  skuParam?: string;

  @IsOptional()
  @IsString()
  itemsPath?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  fieldMap?: Record<string, string>;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
