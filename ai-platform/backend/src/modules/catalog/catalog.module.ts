import { Module } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';
import { TenantResourcesModule } from '../tenant-resources/tenant-resources.module';
import { CatalogRestSourceAdapter } from './catalog-rest-source.adapter';
import { CatalogService } from './catalog.service';
import { CatalogStructuredSourceService } from './catalog-structured-source.service';

@Module({
  imports: [LoggingModule, TenantResourcesModule],
  providers: [
    CatalogStructuredSourceService,
    CatalogRestSourceAdapter,
    CatalogService,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
