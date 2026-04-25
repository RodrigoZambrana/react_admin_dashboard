import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSharedRoutingControlDto {
  @IsOptional()
  @IsString()
  defaultQueueKey?: string | null;

  @IsOptional()
  @IsString()
  queueHeaderKey?: string;

  @IsOptional()
  @IsIn(['customer_public', 'customer_authenticated', 'admin_internal'])
  defaultScope?: 'customer_public' | 'customer_authenticated' | 'admin_internal';
}
