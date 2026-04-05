import {
  buildDocumentChunkBoundaryMetadata,
  classifyDocumentChunkUsageBoundary,
} from '../src/modules/documents/document-chunk-boundary';

describe('Document chunk boundary', () => {
  it('classifies operational guidance chunks away from conversational product knowledge', () => {
    expect(
      classifyDocumentChunkUsageBoundary({
        content:
          'Datos útiles para presupuesto:\n- tipo de roller\n- ancho y alto aproximado\n- cantidad',
      }),
    ).toBe('operational');
  });

  it('keeps product knowledge chunks inside the conversational knowledge boundary', () => {
    expect(
      classifyDocumentChunkUsageBoundary({
        content:
          'Las cortinas de enrollar están disponibles en PVC y aluminio, y pueden ser manuales o motorizadas.',
      }),
    ).toBe('knowledge');
  });

  it('does not mark a mixed knowledge chunk as operational just because later lines contain operational guidance', () => {
    expect(
      classifyDocumentChunkUsageBoundary({
        content:
          'Las cortinas de enrollar están disponibles en PVC y aluminio.\n\nLímites de respuesta: no afirmar colores específicos si no aparecen.',
      }),
    ).toBe('knowledge');
  });

  it('stores boundary metadata during ingestion', () => {
    expect(
      buildDocumentChunkBoundaryMetadata(
        'Cuando la consulta es informativa:\n- responder primero con explicación de producto',
      ),
    ).toEqual(
      expect.objectContaining({
        usageBoundary: 'operational',
        heading: 'Cuando la consulta es informativa',
      }),
    );
  });
});
