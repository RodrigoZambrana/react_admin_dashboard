import { createServer } from 'node:http';

import AdmZip from 'adm-zip';

import { DocumentContentExtractorService } from '../src/modules/documents/document-content-extractor.service';
import { StructuredCatalogUploadAdapter } from '../src/modules/tenant-resources/structured-catalog-upload.adapter';
import { UploadDocxDocumentAdapter } from '../src/modules/tenant-resources/upload-docx-document.adapter';
import { UploadPdfDocumentAdapter } from '../src/modules/tenant-resources/upload-pdf-document.adapter';
import { UploadTextDocumentAdapter } from '../src/modules/tenant-resources/upload-text-document.adapter';
import { UploadXlsxDocumentAdapter } from '../src/modules/tenant-resources/upload-xlsx-document.adapter';
import { UrlDocumentResourceAdapter } from '../src/modules/tenant-resources/url-document-resource.adapter';

describe('DocumentContentExtractorService', () => {
  function createService() {
    return new DocumentContentExtractorService(
      new UploadTextDocumentAdapter(),
      new UploadDocxDocumentAdapter(),
      new UploadXlsxDocumentAdapter(),
      new UploadPdfDocumentAdapter(),
      new UrlDocumentResourceAdapter(),
      new StructuredCatalogUploadAdapter(),
    );
  }

  it('extracts text from DOCX uploads through the tenant-resource adapter boundary', async () => {
    const service = createService();

    const extracted = await service.extractFromUpload({
      originalName: 'catalog.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buildDocxBuffer('Cortinas de enrollar de aluminio'),
    });

    expect(extracted.originKind).toBe('UPLOAD');
    expect(extracted.content).toContain('Cortinas de enrollar de aluminio');
  });

  it('extracts text from XLSX uploads through the tenant-resource adapter boundary', async () => {
    const service = createService();

    const extracted = await service.extractFromUpload({
      originalName: 'catalog.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildXlsxBuffer(),
    });

    expect(extracted.content).toContain('Sheet: Sheet1');
    expect(extracted.content).toContain('sku: B-77');
    expect(extracted.content).toContain('name: Beacon Desk Lamp');
    expect(extracted.metadata).toEqual(
      expect.objectContaining({
        sheetCount: 1,
        sheetNames: ['Sheet1'],
      }),
    );
  });

  it('extracts text from URL-backed documents through a governed adapter', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end('<html><body><h1>Horarios</h1><p>Lunes a viernes</p></body></html>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = address && typeof address === 'object' ? address.port : 0;

    try {
      const service = createService();
      const extracted = await service.extractFromUrl({
        url: `http://127.0.0.1:${port}/hours`,
      });

      expect(extracted.originKind).toBe('URL');
      expect(extracted.content).toContain('Horarios');
      expect(extracted.content).toContain('Lunes a viernes');
    } finally {
      server.close();
    }
  });

  it('preserves headings and list structure from HTML-backed URL documents', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(
        '<html><body><h1>Medios de pago</h1><ul><li>Transferencia</li><li>Mercado Pago</li></ul></body></html>',
      );
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = address && typeof address === 'object' ? address.port : 0;

    try {
      const service = createService();
      const extracted = await service.extractFromUrl({
        url: `http://127.0.0.1:${port}/payments`,
      });

      expect(extracted.content).toContain('Medios de pago');
      expect(extracted.content).toContain('- Transferencia');
      expect(extracted.content).toContain('- Mercado Pago');
    } finally {
      server.close();
    }
  });

  it('rejects structured catalog uploads in the document corpus boundary', async () => {
    const service = createService();

    await expect(
      service.extractFromUpload({
        originalName: 'catalog.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('sku,name\nB-77,Beacon Desk Lamp', 'utf8'),
      }),
    ).rejects.toThrow(
      'Structured catalogs must be loaded through the catalog boundary',
    );
  });

  it('keeps the PDF adapter registered for tenant resource ingestion', () => {
    const adapter = new UploadPdfDocumentAdapter();

    expect(
      adapter.supportsUpload({
        sourceName: 'brochure.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(''),
      }),
    ).toBe(true);
  });
});

function buildDocxBuffer(text: string) {
  const zip = new AdmZip();
  zip.addFile(
    'word/document.xml',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
        </w:body>
      </w:document>`,
      'utf8',
    ),
  );
  return zip.toBuffer();
}

function buildXlsxBuffer() {
  const zip = new AdmZip();
  zip.addFile(
    'xl/workbook.xml',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>
          <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
        </sheets>
      </workbook>`,
      'utf8',
    ),
  );
  zip.addFile(
    'xl/_rels/workbook.xml.rels',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
      </Relationships>`,
      'utf8',
    ),
  );
  zip.addFile(
    'xl/sharedStrings.xml',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <sst>
        <si><t>sku</t></si>
        <si><t>name</t></si>
        <si><t>B-77</t></si>
        <si><t>Beacon Desk Lamp</t></si>
      </sst>`,
      'utf8',
    ),
  );
  zip.addFile(
    'xl/worksheets/sheet1.xml',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <worksheet>
        <sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c>
            <c r="B1" t="s"><v>1</v></c>
          </row>
          <row r="2">
            <c r="A2" t="s"><v>2</v></c>
            <c r="B2" t="s"><v>3</v></c>
          </row>
        </sheetData>
      </worksheet>`,
      'utf8',
    ),
  );
  return zip.toBuffer();
}
