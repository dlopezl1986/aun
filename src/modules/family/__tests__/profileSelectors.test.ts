import { ageParts, zodiacOf } from '../selectors';

describe('profile selectors', () => {
  it('computes years and months', () => {
    expect(ageParts('2024-07-10', '2026-11-04')).toEqual({ years: 2, months: 3 });
    expect(ageParts('2024-07-04', '2026-11-04')).toEqual({ years: 2, months: 4 });
  });
  it('finds the zodiac sign', () => {
    expect(zodiacOf('1986-03-21').sign).toBe('aries');
    expect(zodiacOf('1990-01-05').sign).toBe('capricorn');
    expect(zodiacOf('1990-12-25').sign).toBe('capricorn');
    expect(zodiacOf('2020-08-01').sign).toBe('leo');
  });
});
