import { IsOptional, IsString, MinLength } from 'class-validator';

export class AdminTestCenterEvaluateDto {
  @IsString()
  @MinLength(1)
  scenarioId!: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
