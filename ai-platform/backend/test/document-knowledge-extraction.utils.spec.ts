import {
  captureDocumentKnowledgeLabeledValue,
  extractInlineDocumentKnowledgeAxisValues,
  normalizeDocumentKnowledgeHeading,
  resolveDocumentKnowledgeSectionListEntry,
  splitStructuredDocumentKnowledgeValues,
} from '../src/modules/documents/document-knowledge-extraction.utils';

describe('document knowledge extraction utils', () => {
  it('normalizes headings and captures labeled values generically', () => {
    expect(normalizeDocumentKnowledgeHeading('7.1. ATRIBUTOS:')).toBe('ATRIBUTOS');
    expect(
      captureDocumentKnowledgeLabeledValue('Atributos: alfa, beta', ['atributos']),
    ).toBe('alfa, beta');
  });

  it('resolves section list entries without depending on a domain-specific corpus', () => {
    expect(
      resolveDocumentKnowledgeSectionListEntry({
        sentence: '- gamma',
        sectionHeading: 'Atributos',
        headingTerms: ['atributos'],
      }),
    ).toBe('gamma');
  });

  it('splits structured values and inline axis values by form', () => {
    expect(
      splitStructuredDocumentKnowledgeValues('alfa y beta, gamma', {
        conjunctionTerms: ['y'],
      }),
    ).toEqual(['alfa', 'beta', 'gamma']);

    expect(
      extractInlineDocumentKnowledgeAxisValues({
        sentence: 'Etiquetas(alpha beta gamma)',
        axisTerms: ['etiquetas'],
        options: {
          conjunctionTerms: ['y'],
        },
      }),
    ).toEqual(['alpha', 'beta', 'gamma']);
  });
});
