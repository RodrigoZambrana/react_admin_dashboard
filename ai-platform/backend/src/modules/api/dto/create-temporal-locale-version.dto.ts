import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateTemporalLocaleVersionDto {
  @IsString()
  locale!: string;

  @IsObject()
  resource!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
