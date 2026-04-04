import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCriticalConfigVersionDto {
  @IsString()
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
