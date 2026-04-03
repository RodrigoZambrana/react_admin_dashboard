import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePromptVersionDto {
  @IsString()
  key!: string;

  @IsString()
  @MaxLength(12000)
  template!: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
