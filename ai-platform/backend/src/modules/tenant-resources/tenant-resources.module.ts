import { Module } from '@nestjs/common';

import { StructuredCatalogUploadAdapter } from './structured-catalog-upload.adapter';
import { UploadDocxDocumentAdapter } from './upload-docx-document.adapter';
import { UploadPdfDocumentAdapter } from './upload-pdf-document.adapter';
import { UploadTextDocumentAdapter } from './upload-text-document.adapter';
import { UploadXlsxDocumentAdapter } from './upload-xlsx-document.adapter';
import { UrlDocumentResourceAdapter } from './url-document-resource.adapter';

@Module({
  providers: [
    UploadTextDocumentAdapter,
    UploadDocxDocumentAdapter,
    UploadXlsxDocumentAdapter,
    UploadPdfDocumentAdapter,
    UrlDocumentResourceAdapter,
    StructuredCatalogUploadAdapter,
  ],
  exports: [
    UploadTextDocumentAdapter,
    UploadDocxDocumentAdapter,
    UploadXlsxDocumentAdapter,
    UploadPdfDocumentAdapter,
    UrlDocumentResourceAdapter,
    StructuredCatalogUploadAdapter,
  ],
})
export class TenantResourcesModule {}
