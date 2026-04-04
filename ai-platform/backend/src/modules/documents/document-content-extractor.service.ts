import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentOriginKind } from '@prisma/client';

import { StructuredCatalogUploadAdapter } from '../tenant-resources/structured-catalog-upload.adapter';
import {
  TenantResourceExtraction,
  TenantResourceUploadInput,
} from '../tenant-resources/tenant-resource.types';
import { UploadDocxDocumentAdapter } from '../tenant-resources/upload-docx-document.adapter';
import { UploadPdfDocumentAdapter } from '../tenant-resources/upload-pdf-document.adapter';
import { UploadTextDocumentAdapter } from '../tenant-resources/upload-text-document.adapter';
import { UploadXlsxDocumentAdapter } from '../tenant-resources/upload-xlsx-document.adapter';
import { UrlDocumentResourceAdapter } from '../tenant-resources/url-document-resource.adapter';
import { ExtractedDocumentSource } from './document.types';

@Injectable()
export class DocumentContentExtractorService {
  private readonly uploadAdapters;

  constructor(
    private readonly textUploadAdapter: UploadTextDocumentAdapter,
    private readonly docxUploadAdapter: UploadDocxDocumentAdapter,
    private readonly xlsxUploadAdapter: UploadXlsxDocumentAdapter,
    private readonly pdfUploadAdapter: UploadPdfDocumentAdapter,
    private readonly urlDocumentResourceAdapter: UrlDocumentResourceAdapter,
    private readonly structuredCatalogUploadAdapter: StructuredCatalogUploadAdapter,
  ) {
    this.uploadAdapters = [
      this.textUploadAdapter,
      this.docxUploadAdapter,
      this.xlsxUploadAdapter,
      this.pdfUploadAdapter,
    ];
  }

  async extractFromUpload(input: {
    originalName: string;
    mimeType?: string | null;
    buffer: Buffer;
    language?: string | null;
  }): Promise<ExtractedDocumentSource> {
    const adapterInput: TenantResourceUploadInput = {
      sourceName: input.originalName,
      mimeType: input.mimeType ?? null,
      buffer: input.buffer,
      language: input.language ?? null,
    };
    const adapter = this.uploadAdapters.find((candidate) =>
      candidate.supportsUpload(adapterInput),
    );

    if (!adapter) {
      if (this.structuredCatalogUploadAdapter.supportsUpload(adapterInput)) {
        throw new BadRequestException(
          'Structured catalogs must be loaded through the catalog boundary, not the document corpus',
        );
      }

      throw new BadRequestException(
        `Unsupported document type "${input.mimeType ?? input.originalName}"`,
      );
    }

    const extracted = await adapter.extractFromUpload(adapterInput);
    return this.mapExtraction(extracted, DocumentOriginKind.UPLOAD);
  }

  async extractFromUrl(input: {
    url: string;
    title?: string | null;
    language?: string | null;
  }): Promise<ExtractedDocumentSource> {
    if (
      !this.urlDocumentResourceAdapter.supportsUrl({
        url: input.url,
        title: input.title ?? null,
        language: input.language ?? null,
      })
    ) {
      throw new BadRequestException(`Unsupported document URL "${input.url}"`);
    }

    const extracted = await this.urlDocumentResourceAdapter.extractFromUrl({
      url: input.url,
      title: input.title ?? null,
      language: input.language ?? null,
    });

    return this.mapExtraction(extracted, DocumentOriginKind.URL);
  }

  private mapExtraction(
    extracted: TenantResourceExtraction,
    originKind: DocumentOriginKind,
  ): ExtractedDocumentSource {
    if (extracted.contentType !== 'text') {
      throw new BadRequestException(
        'Document extraction produced structured content instead of plain knowledge text',
      );
    }

    if (!extracted.textContent.trim()) {
      throw new BadRequestException(
        'Uploaded document does not contain usable text',
      );
    }

    return {
      originKind,
      sourceName: extracted.sourceName ?? null,
      mimeType: extracted.mimeType ?? null,
      language: extracted.language ?? null,
      content: extracted.textContent.trim(),
    };
  }
}
