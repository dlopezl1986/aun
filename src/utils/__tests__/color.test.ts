import { contrastRatio, readableOn, swatchNeedsOutline } from '../color';

describe('readableOn', () => {
  const darkSurface = '#151A2E';

  it('lifts dark accents until they read on a dark surface', () => {
    for (const accent of ['#475569', '#7C3AED', '#2563EB', '#4C1D95', '#DC2626']) {
      expect(contrastRatio(readableOn(accent, darkSurface), darkSurface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps colours that already read well, near-black ink and light backgrounds', () => {
    expect(readableOn('#FFFFFF', darkSurface)).toBe('#FFFFFF');
    expect(readableOn('#111827', darkSurface)).toBe('#111827');
    expect(readableOn('#475569', '#FFFFFF')).toBe('#475569');
    expect(readableOn('rgba(0,0,0,0.5)', darkSurface)).toBe('rgba(0,0,0,0.5)');
  });
});

describe('swatchNeedsOutline', () => {
  it('outlines light swatches in light mode and very dark ones in dark mode', () => {
    expect(swatchNeedsOutline('#E2E8F0', 'light')).toBe(true);
    expect(swatchNeedsOutline('#1E293B', 'light')).toBe(false);
    expect(swatchNeedsOutline('#1E293B', 'dark')).toBe(true);
    expect(swatchNeedsOutline('#E2E8F0', 'dark')).toBe(false);
  });
});
