import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateUrlDocumentDto {
  @IsUrl()
  url!: string;

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
