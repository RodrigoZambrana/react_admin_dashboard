import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import { ExtractedDocumentSource } from './document.types';

const supportedMimeTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
  'text/html',
  'application/xhtml+xml',
  'application/octet-stream',
]);

@Injectable()
export class DocumentContentExtractorService {
  extractFromUpload(input: {
    originalName: string;
    mimeType?: string | null;
    buffer: Buffer;
    language?: string | null;
  }): ExtractedDocumentSource {
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    const extension = extname(input.originalName).toLowerCase();

    if (!this.isSupported(mimeType, extension)) {
      throw new BadRequestException(
        `Unsupported document type "${mimeType ?? (extension || 'unknown')}"`,
      );
    }

    const raw = input.buffer.toString('utf8');
    const content = this.normalizeExtractedText(
      mimeType === 'text/html' || mimeType === 'application/xhtml+xml'
        ? raw.replace(/<[^>]+>/g, ' ')
        : raw,
    );

    if (content.length === 0) {
      throw new BadRequestException('Uploaded document does not contain usable text');
    }

    return {
      originKind: 'UPLOAD',
      sourceName: input.originalName,
      mimeType: mimeType ?? this.resolveMimeTypeFromExtension(extension),
      language: input.language ?? null,
      content,
    };
  }

  private isSupported(mimeType: string | null, extension: string) {
    if (mimeType && supportedMimeTypes.has(mimeType)) {
      return true;
    }

    return ['.txt', '.md', '.markdown', '.json', '.html', '.htm'].includes(
      extension,
    );
  }

  private resolveMimeTypeFromExtension(extension: string) {
    if (extension === '.md' || extension === '.markdown') {
      return 'text/markdown';
    }

    if (extension === '.json') {
      return 'application/json';
    }

    if (extension === '.html' || extension === '.htm') {
      return 'text/html';
    }

    return 'text/plain';
  }

  private normalizeExtractedText(value: string) {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/\u0000/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
