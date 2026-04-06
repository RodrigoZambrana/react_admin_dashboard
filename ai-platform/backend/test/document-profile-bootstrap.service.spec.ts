import { DocumentProfileBootstrapService } from '../src/modules/documents/document-profile-bootstrap.service';

describe('DocumentProfileBootstrapService', () => {
  it('derives bounded internal hints from extracted document claims without requiring manual config', () => {
    const service = new DocumentProfileBootstrapService();

    const hints = service.deriveHints({
      activeProfileIds: ['product_catalog'],
      chunks: [
        {
          sequence: 0,
          content: 'Disponibles en PVC y aluminio.',
          searchText: 'disponibles en pvc y aluminio',
          retrievalProjection: 'cortinas enrollar pvc aluminio',
          metadata: {
            section: 'CORTINAS DE ENROLLAR',
          },
          structuredItems: [
            {
              sequence: 0,
              kind: 'claim',
              label: 'materials',
              valueText: 'PVC | aluminio',
              normalizedValue: 'pvc aluminio',
              supportClass: 'explicit_fact',
              evidenceTextSpan: 'Disponibles en PVC y aluminio.',
              metadata: {
                extractionScope: 'tenant_only',
                profileKey: 'product_catalog',
                claim: {
                  axis: 'materials',
                  kind: 'value_list',
                  values: ['PVC', 'aluminio'],
                },
              },
            },
          ],
        },
      ],
    });

    expect(hints).toEqual(
      expect.objectContaining({
        approvedByUpload: true,
        manualConfigRequired: false,
        activeProfileIds: ['product_catalog'],
        profiles: [
          expect.objectContaining({
            profileId: 'product_catalog',
            hints: expect.objectContaining({
              observedSections: ['CORTINAS DE ENROLLAR'],
              observedAxes: ['materials'],
              observedValuesByAxis: {
                materials: ['PVC', 'aluminio'],
              },
              sectionAliasesByAxis: {
                materials: ['CORTINAS DE ENROLLAR'],
              },
              supportCounts: {
                explicit: 1,
                partial: 0,
                boundedInference: 0,
              },
            }),
          }),
        ],
      }),
    );
  });
});
