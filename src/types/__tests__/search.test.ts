import { matchScore, normalizeSearch } from '../search';

describe('search matching', () => {
  it('ignores case and accents', () => {
    expect(normalizeSearch('  Póliza SEGURO ')).toBe('poliza seguro');
    expect(matchScore('Colegio de Elisa', 'colegío')).toBeGreaterThan(0);
  });

  it('ranks prefix matches above substring matches', () => {
    expect(matchScore('Seguro coche', 'seg')).toBe(2);
    expect(matchScore('Mi seguro', 'seg')).toBe(1);
    expect(matchScore('Factura', 'seg')).toBe(0);
  });
});
