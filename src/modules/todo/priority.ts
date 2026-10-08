import { useTheme } from '@/theme';
import type { TaskPriority } from './types';

export function usePriorityColors(): Record<TaskPriority, string> {
  const { colors } = useTheme();
  return { 1: colors.danger, 2: '#F97316', 3: colors.info, 4: colors.textSubtle };
}

export const PRIORITIES: TaskPriority[] = [1, 2, 3, 4];
