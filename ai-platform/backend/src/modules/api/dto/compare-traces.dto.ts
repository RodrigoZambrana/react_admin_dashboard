import { IsString, MinLength } from 'class-validator';

export class CompareTracesDto {
  @IsString()
  @MinLength(1)
  leftTraceId!: string;

  @IsString()
  @MinLength(1)
  rightTraceId!: string;
}
