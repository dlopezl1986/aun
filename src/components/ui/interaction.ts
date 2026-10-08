import type { PressableStateCallbackType } from 'react-native';

/** react-native-web adds `hovered`/`focused` to Pressable state; native only has `pressed`. */
export interface InteractionState {
  pressed: boolean;
  hovered: boolean;
  focused: boolean;
}

export function interaction(state: PressableStateCallbackType): InteractionState {
  const s = state as PressableStateCallbackType & { hovered?: boolean; focused?: boolean };
  return { pressed: s.pressed, hovered: !!s.hovered, focused: !!s.focused };
}
