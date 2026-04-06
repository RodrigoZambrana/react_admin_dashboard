import { DocumentIngestionStatus, ManagedResourceStatus } from '@prisma/client';

import { DocumentService } from '../src/modules/documents/document.service';

describe('DocumentService', () => {
  it('invalidates ingestion and clears derived state when source text changes', async () => {
    const documentRepository = {
      findById: jest.fn(async () => ({
        id: 'doc-1',
        title: 'Documento',
        status: ManagedResourceStatus.ACTIVE,
        ingestionStatus: DocumentIngestionStatus.READY,
        language: 'es',
        sourceText: 'Texto original',
        metadata: {
          extractionBootstrap: {
            profiles: [],
          },
          lastIngestedBy: 'system',
        },
      })),
      update: jest.fn(async () => ({
        id: 'doc-1',
        status: ManagedResourceStatus.DRAFT,
        ingestionStatus: DocumentIngestionStatus.PENDING,
      })),
    };
    const documentChunkRepository = {
      clearForDocument: jest.fn(async () => ({ count: 2 })),
    };
    const documentExtractionProfileConfigService = {
      clearTenantDerivedHints: jest.fn(async () => undefined),
    };
    const service = new DocumentService(
      documentRepository as any,
      documentChunkRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      documentExtractionProfileConfigService as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.updateDocument('doc-1', {
        content: 'Texto actualizado',
        createdBy: 'tester',
      }),
    ).resolves.toEqual({
      id: 'doc-1',
      status: ManagedResourceStatus.DRAFT,
      ingestionStatus: DocumentIngestionStatus.PENDING,
    });

    expect(documentRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        sourceText: 'Texto actualizado',
        invalidateIngestion: true,
        nextStatus: ManagedResourceStatus.DRAFT,
        metadata: expect.objectContaining({
          lastEditedBy: 'tester',
        }),
      }),
    );
    expect(documentChunkRepository.clearForDocument).toHaveBeenCalledWith('doc-1');
    expect(
      documentExtractionProfileConfigService.clearTenantDerivedHints,
    ).toHaveBeenCalledWith('doc-1');
  });

  it('updates non-structural fields without invalidating ingestion', async () => {
    const documentRepository = {
      findById: jest.fn(async () => ({
        id: 'doc-1',
        title: 'Documento',
        status: ManagedResourceStatus.ACTIVE,
        ingestionStatus: DocumentIngestionStatus.READY,
        language: 'es',
        sourceText: 'Texto original',
        metadata: null,
      })),
      update: jest.fn(async () => ({
        id: 'doc-1',
        title: 'Nuevo titulo',
        status: ManagedResourceStatus.ACTIVE,
        ingestionStatus: DocumentIngestionStatus.READY,
      })),
    };
    const documentChunkRepository = {
      clearForDocument: jest.fn(async () => ({ count: 0 })),
    };
    const documentExtractionProfileConfigService = {
      clearTenantDerivedHints: jest.fn(async () => undefined),
    };
    const service = new DocumentService(
      documentRepository as any,
      documentChunkRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      documentExtractionProfileConfigService as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.updateDocument('doc-1', {
        title: 'Nuevo titulo',
      }),
    ).resolves.toEqual({
      id: 'doc-1',
      title: 'Nuevo titulo',
      status: ManagedResourceStatus.ACTIVE,
      ingestionStatus: DocumentIngestionStatus.READY,
    });

    expect(documentRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        title: 'Nuevo titulo',
        invalidateIngestion: false,
      }),
    );
    expect(documentChunkRepository.clearForDocument).not.toHaveBeenCalled();
    expect(
      documentExtractionProfileConfigService.clearTenantDerivedHints,
    ).not.toHaveBeenCalled();
  });

  it('deletes a document and returns a deletion receipt', async () => {
    const documentRepository = {
      findById: jest.fn(async () => ({
        id: 'doc-1',
        title: 'Documento',
        status: ManagedResourceStatus.ARCHIVED,
        ingestionStatus: DocumentIngestionStatus.READY,
        sourceText: 'Texto original',
      })),
      delete: jest.fn(async () => ({ count: 1 })),
    };
    const service = new DocumentService(
      documentRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(service.deleteDocument('doc-1')).resolves.toEqual({
      deleted: true,
      documentId: 'doc-1',
    });
    expect(documentRepository.delete).toHaveBeenCalledWith('doc-1');
  });
});
