import { IsOptional, IsString } from 'class-validator';

export class UpdateAiRuntimeSecureCredentialDto {
  @IsOptional()
  @IsString()
  value?: string | null;
}
