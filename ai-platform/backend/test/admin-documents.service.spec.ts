import { BadRequestException } from '@nestjs/common';

import { AdminDocumentsService } from '../src/modules/api/admin-documents.service';

describe('AdminDocumentsService', () => {
  it('routes list/detail/create/ingest flows through the document domain service', async () => {
    const documentService = {
      listDocuments: jest.fn(async () => [{ id: 'doc-1' }]),
      getDocument: jest.fn(async () => ({ id: 'doc-1' })),
      updateDocument: jest.fn(async () => ({ id: 'doc-1', title: 'Updated' })),
      getKnowledgeView: jest.fn(async () => ({ scope: 'active_corpus' })),
      createTextDocument: jest.fn(async () => ({ id: 'doc-text' })),
      createUploadedDocument: jest.fn(async () => ({ id: 'doc-upload' })),
      ingestDocument: jest.fn(async () => ({ id: 'doc-ingested' })),
      activateDocument: jest.fn(async () => ({ id: 'doc-active' })),
      archiveDocument: jest.fn(async () => ({ id: 'doc-archived' })),
      deleteDocument: jest.fn(async () => ({ deleted: true, documentId: 'doc-1' })),
    };
    const service = new AdminDocumentsService(documentService as any);

    await expect(
      service.listDocuments({
        status: 'ACTIVE',
        ingestionStatus: 'READY',
        limit: 10,
      }),
    ).resolves.toEqual([{ id: 'doc-1' }]);
    expect(documentService.listDocuments).toHaveBeenCalledWith({
      status: 'ACTIVE',
      ingestionStatus: 'READY',
      limit: 10,
    });

    await expect(service.getDocument('doc-1')).resolves.toEqual({ id: 'doc-1' });
    await expect(
      service.updateDocument('doc-1', {
        title: 'Updated',
      }),
    ).resolves.toEqual({ id: 'doc-1', title: 'Updated' });
    expect(documentService.updateDocument).toHaveBeenCalledWith('doc-1', {
      title: 'Updated',
    });
    await expect(
      service.getKnowledgeView({
        documentId: 'doc-1',
        limit: 20,
      }),
    ).resolves.toEqual({ scope: 'active_corpus' });
    expect(documentService.getKnowledgeView).toHaveBeenCalledWith({
      documentId: 'doc-1',
      limit: 20,
    });
    await expect(
      service.createTextDocument({
        title: 'Manual',
        content: 'Contenido',
        activate: true,
      }),
    ).resolves.toEqual({ id: 'doc-text' });
    await expect(
      service.createUploadedDocument({
        title: 'Archivo',
        activate: true,
        file: {
          originalName: 'manual.txt',
          buffer: Buffer.from('Contenido'),
        },
      }),
    ).resolves.toEqual({ id: 'doc-upload' });
    await expect(
      service.ingestDocument('doc-1', {
        activate: true,
      }),
    ).resolves.toEqual({ id: 'doc-ingested' });
    await expect(service.activateDocument('doc-1')).resolves.toEqual({
      id: 'doc-active',
    });
    await expect(service.archiveDocument('doc-1')).resolves.toEqual({
      id: 'doc-archived',
    });
    await expect(service.deleteDocument('doc-1')).resolves.toEqual({
      deleted: true,
      documentId: 'doc-1',
    });
  });

  it('fails safely on unsupported filters', async () => {
    const service = new AdminDocumentsService({} as any);

    expect(() =>
      service.listDocuments({
        status: 'BROKEN',
      }),
    ).toThrow(BadRequestException);
  });
});
