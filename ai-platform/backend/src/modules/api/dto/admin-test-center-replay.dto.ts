import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReplayTurnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class AdminTestCenterReplayDto {
  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  scenarioId?: string;

  @IsOptional()
  @IsBoolean()
  autoEvaluate?: boolean;

  @ValidateIf((value) => !value.scenarioId)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReplayTurnDto)
  turns?: ReplayTurnDto[];
}
