import { useWindowDimensions } from 'react-native';

/**
 * compact  < 768   phones                → bottom navigation
 * medium   768–1099 tablets portrait     → icon rail sidebar
 * expanded 1100–1439 tablets landscape/laptops → full sidebar
 * wide     ≥ 1440  desktop               → full sidebar, wider grid
 */
export type Breakpoint = 'compact' | 'medium' | 'expanded' | 'wide';

export function breakpointFor(width: number): Breakpoint {
  if (width < 768) return 'compact';
  if (width < 1100) return 'medium';
  if (width < 1440) return 'expanded';
  return 'wide';
}

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const bp = breakpointFor(width);
  return {
    breakpoint: bp,
    width,
    height,
    isCompact: bp === 'compact',
    hasSidebar: bp !== 'compact',
    /** Number of dashboard grid columns. */
    columns: bp === 'compact' ? 1 : bp === 'medium' ? 2 : bp === 'expanded' ? 2 : 3,
  };
}
