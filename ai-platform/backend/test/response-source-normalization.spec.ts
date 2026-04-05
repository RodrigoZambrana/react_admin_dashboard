import { normalizeSourceObliviousSummary } from '../src/modules/response/response-source-normalization';

describe('response source normalization', () => {
  it('strips explicit source lead-ins without exposing document voice', () => {
    expect(
      normalizeSourceObliviousSummary(
        'El documento indica que hay variedad de colores.',
      ),
    ).toBe('Hay variedad de colores.');
  });

  it('rewrites company narration only inside the dedicated presentation helper', () => {
    expect(
      normalizeSourceObliviousSummary('Urucortinas ofrece cortinas roller blackout.'),
    ).toBe('Tenemos cortinas roller blackout.');
  });
});
