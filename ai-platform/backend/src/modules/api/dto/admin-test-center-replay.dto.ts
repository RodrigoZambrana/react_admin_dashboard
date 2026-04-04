import {
  ArrayMinSize,
  IsArray,
  MinLength,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReplayTurnDto)
  turns!: ReplayTurnDto[];
}
