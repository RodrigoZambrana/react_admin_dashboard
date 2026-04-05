import { normalizeSourceObliviousSummary } from '../src/modules/response/response-source-normalization';

describe('response source normalization', () => {
  it('strips explicit Spanish source lead-ins without exposing document voice', () => {
    expect(
      normalizeSourceObliviousSummary(
        'El documento indica que hay variedad de colores.',
      ),
    ).toBe('Hay variedad de colores.');
  });

  it('strips explicit English source lead-ins without exposing document voice', () => {
    expect(
      normalizeSourceObliviousSummary(
        'The catalog says that there are blackout and screen options.',
      ),
    ).toBe('There are blackout and screen options.');
  });

  it('rewrites third-person company voice into direct service voice for offering language', () => {
    expect(
      normalizeSourceObliviousSummary('Urucortinas ofrece cortinas roller blackout.'),
    ).toBe('Tenemos cortinas roller blackout.');
  });

  it('rewrites third-person company voice into direct service voice for execution language', () => {
    expect(
      normalizeSourceObliviousSummary('Urucortinas realiza instalación de cortinas de enrollar.'),
    ).toBe('Realizamos instalación de cortinas de enrollar.');
  });

  it('keeps non-matching text unchanged', () => {
    expect(
      normalizeSourceObliviousSummary('Las cortinas roller blackout ayudan a oscurecer el ambiente.'),
    ).toBe('Las cortinas roller blackout ayudan a oscurecer el ambiente.');
  });
});
