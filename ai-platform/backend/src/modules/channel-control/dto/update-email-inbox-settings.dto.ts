import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateEmailInboxSettingsDto {
  @IsOptional()
  @IsString()
  imapHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  imapPort?: number | null;

  @IsOptional()
  @IsIn(['SSL_TLS', 'STARTTLS', 'NONE'])
  imapSecurity?: 'SSL_TLS' | 'STARTTLS' | 'NONE' | null;

  @IsOptional()
  @IsString()
  smtpHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number | null;

  @IsOptional()
  @IsIn(['SSL_TLS', 'STARTTLS', 'NONE'])
  smtpSecurity?: 'SSL_TLS' | 'STARTTLS' | 'NONE' | null;

  @IsOptional()
  @IsString()
  username?: string | null;

  @IsOptional()
  @IsString()
  password?: string | null;

  @IsOptional()
  @IsEmail()
  fromAddress?: string | null;

  @IsOptional()
  @IsString()
  fromName?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxAttachmentSizeMb?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  ratePerMinute?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  pollIntervalMs?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  pollBatchSize?: number | null;
}
