import { IsOptional, IsString } from 'class-validator';

export class ActivateManagedResourceVersionDto {
  @IsOptional()
  @IsString()
  createdBy?: string;
}
