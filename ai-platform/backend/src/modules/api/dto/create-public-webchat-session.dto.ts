import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePublicWebchatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tenantKey?: string;

  @IsString()
  @MaxLength(120)
  guestId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  page?: string | null;

  @IsOptional()
  @IsBoolean()
  authenticated?: boolean;
}
