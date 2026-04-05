import { readFileSync } from 'node:fs';

describe('Document knowledge extraction architecture', () => {
  it('keeps extraction vocabularies and presentation phrasing ownership out of the extractor boundary', () => {
    const serviceSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-knowledge-extraction.service.ts',
      'utf8',
    );
    const catalogSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-knowledge-extraction.catalogs.ts',
      'utf8',
    );

    expect(serviceSource).toContain('document-knowledge-extraction.catalogs');
    expect(serviceSource).not.toContain('renderMaterialsClaim');
    expect(serviceSource).not.toContain('renderOperationModesClaim');
    expect(serviceSource).not.toContain('renderProductTypesClaim');
    expect(catalogSource).not.toContain('Tipos disponibles:');
    expect(catalogSource).not.toContain('Trabajamos con');
    expect(catalogSource).not.toContain('Tenemos variedad de colores.');
    expect(catalogSource).not.toContain('Puede ser una opción adecuada para');
    expect(catalogSource).not.toContain("'pvc'");
    expect(catalogSource).not.toContain("'aluminio'");
    expect(catalogSource).not.toContain("'vinilo'");
  });
});
